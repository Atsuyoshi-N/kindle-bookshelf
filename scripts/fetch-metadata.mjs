#!/usr/bin/env node

/**
 * books.json 内のISBN・総ページ数が未設定の本について、
 * 国立国会図書館（NDL）検索APIとGoogle Books APIからメタデータを取得するスクリプト
 *
 * 使い方:
 *   node scripts/fetch-metadata.mjs
 *
 * オプション:
 *   --dry-run  変更を保存せずに結果だけ表示
 *   --all      ISBN/ページ数が既にある本も含めて全て対象にする
 *   --delay    リクエスト間の待機時間(ms)。デフォルト: 1000
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_JSON_PATH = path.join(__dirname, "..", "data", "books.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { dryRun: false, all: false, delay: 1000 };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") parsed.dryRun = true;
    else if (args[i] === "--all") parsed.all = true;
    else if (args[i] === "--delay" && args[i + 1]) {
      parsed.delay = parseInt(args[++i], 10);
    }
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean title for search: remove series info, volume numbers, publisher tags
 */
function cleanTitleForSearch(title) {
  return title
    .replace(/\s*[\(（](?![０-９\d]+[\)）])[^）\)]*[\)）]\s*/g, "") // Remove (アフタヌーンコミックス) but keep （２）
    .replace(/\s*[\[【].*?[\]】]\s*/g, "") // Remove [雑誌] etc
    .replace(/　/g, " ") // Full-width space to half-width
    .trim();
}

/**
 * Search NDL (National Diet Library) API
 * Returns { isbn, totalPages } or null
 */
async function searchNDL(title) {
  const query = cleanTitleForSearch(title);
  const url = `https://ndlsearch.ndl.go.jp/api/opensearch?any=${encodeURIComponent(query)}&cnt=5`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const xml = await response.text();

    // Parse XML manually (no external deps)
    const items = xml.split("<item>").slice(1);

    let bestMatch = null;

    for (const item of items) {
      // Skip audio/video items
      if (item.includes("デイジー") || item.includes("録音") || item.includes("CD")) {
        continue;
      }

      // Extract title
      const itemTitleMatch = item.match(/<title>([^<]+)/);
      const itemTitle = itemTitleMatch?.[1] ?? "";

      // Extract ISBN
      let isbn = null;
      const isbn13Match = item.match(
        /type="dcndl:ISBN"[^>]*>(\d{3}[-\s]?\d[-\s]?\d{2}[-\s]?\d{6}[-\s]?\d)/
      );
      if (isbn13Match) {
        isbn = isbn13Match[1].replace(/[-\s]/g, "");
      }
      if (!isbn) {
        const isbnMatch = item.match(
          /type="dcndl:ISBN"[^>]*>([\d-]+)/
        );
        if (isbnMatch) {
          isbn = isbnMatch[1].replace(/[-\s]/g, "");
        }
      }

      // Extract page count from extent (e.g., "323p", "462p ; 20cm")
      let totalPages = null;
      const extentMatch = item.match(/<dc:extent[^>]*>(\d+)p/);
      if (extentMatch) {
        totalPages = parseInt(extentMatch[1], 10);
      }

      if (isbn || totalPages) {
        // Prefer results that match title more closely
        const titleLower = cleanTitleForSearch(title).toLowerCase();
        const itemTitleLower = cleanTitleForSearch(itemTitle).toLowerCase();

        if (
          itemTitleLower.includes(titleLower) ||
          titleLower.includes(itemTitleLower)
        ) {
          bestMatch = { isbn, totalPages };
          break;
        }

        if (!bestMatch) {
          bestMatch = { isbn, totalPages };
        }
      }
    }

    return bestMatch;
  } catch (error) {
    return null;
  }
}

/**
 * Search Google Books API
 * Returns { isbn, totalPages } or null
 */
async function searchGoogleBooks(title) {
  const query = cleanTitleForSearch(title);
  const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&langRestrict=ja&maxResults=3`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const cleanedQuery = cleanTitleForSearch(title).toLowerCase();

    // Extract volume number from original title (e.g., "メダリスト（２）" → "2")
    const volMatch = title.match(/[（(]\s*([０-９\d]+)\s*[）)]/);
    const queryVolume = volMatch
      ? volMatch[1].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
      : null;

    for (const item of data.items) {
      const vi = item.volumeInfo ?? {};
      const resultTitle = (vi.title ?? "").toLowerCase();

      // Skip results that don't reasonably match the title
      // (prevents series mismatch, e.g., vol.10 matching vol.2)
      if (
        !resultTitle.includes(cleanedQuery) &&
        !cleanedQuery.includes(resultTitle)
      ) {
        continue;
      }

      // If the query has a volume number, check the result also matches that volume
      if (queryVolume) {
        const fullResultTitle = `${vi.title ?? ""} ${vi.subtitle ?? ""}`;
        const resultVolMatch = fullResultTitle.match(/(\d+)/);
        if (resultVolMatch && resultVolMatch[1] !== queryVolume) {
          continue;
        }
      }

      let isbn = null;
      let totalPages = vi.pageCount > 0 ? vi.pageCount : null;

      const identifiers = vi.industryIdentifiers ?? [];
      for (const id of identifiers) {
        if (id.type === "ISBN_13") {
          isbn = id.identifier;
          break;
        }
        if (id.type === "ISBN_10" && !isbn) {
          isbn = id.identifier;
        }
      }

      if (isbn || totalPages) {
        return { isbn, totalPages };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  const args = parseArgs();

  const data = JSON.parse(fs.readFileSync(BOOKS_JSON_PATH, "utf-8"));
  const books = data.books;

  // Target books with known titles but missing ISBN or totalPages
  const targets = books.filter((b) => {
    if (!b.title || b.title.startsWith("不明") || b.title === "Amazon.co.jp") return false;
    if (args.all) return true;
    return !b.isbn || !b.totalPages;
  });

  console.log(`対象: ${targets.length}冊`);
  console.log(`待機時間: ${args.delay}ms`);
  console.log("ソース: NDL検索API → Google Books API（フォールバック）");
  if (args.dryRun) console.log("(ドライラン: 変更は保存されません)");
  console.log();

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    process.stdout.write(
      `[${i + 1}/${targets.length}] ${book.title.substring(0, 40)} ... `
    );

    // Try NDL first
    let result = await searchNDL(book.title);
    let source = "NDL";

    // Fallback to Google Books
    if (!result || (!result.isbn && !result.totalPages)) {
      await sleep(500);
      result = await searchGoogleBooks(book.title);
      source = "Google";
    }

    if (result) {
      let changes = [];

      if (result.isbn && !book.isbn) {
        // Normalize to 13-digit ISBN
        let isbn = result.isbn;
        if (isbn.length === 10) {
          isbn = isbn10to13(isbn);
        }
        book.isbn = isbn;
        changes.push(`ISBN: ${isbn}`);
      }

      if (result.totalPages && !book.totalPages) {
        book.totalPages = result.totalPages;
        changes.push(`${result.totalPages}ページ`);
      }

      if (changes.length > 0) {
        console.log(`${changes.join(", ")} (${source})`);
        updated++;
      } else {
        console.log("新しい情報なし");
      }
    } else {
      console.log("見つからず");
      failed++;
    }

    if (i < targets.length - 1) {
      await sleep(args.delay);
    }
  }

  console.log();
  console.log(`結果: 更新 ${updated}冊, 未検出 ${failed}冊`);

  if (!args.dryRun && updated > 0) {
    fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(`${BOOKS_JSON_PATH} を更新しました`);
  }
}

/**
 * Convert ISBN-10 to ISBN-13
 */
function isbn10to13(isbn10) {
  const base = "978" + isbn10.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

main();
