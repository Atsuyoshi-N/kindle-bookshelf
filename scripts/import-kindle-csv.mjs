#!/usr/bin/env node

/**
 * Amazon Kindleデータエクスポートから books.json を生成するスクリプト
 *
 * 使い方:
 *   node scripts/import-kindle-csv.mjs --kindle-dir ~/Downloads/Kindle
 *
 * または個別にファイルを指定:
 *   node scripts/import-kindle-csv.mjs \
 *     --sessions path/to/Kindle.Devices.ReadingSession.csv \
 *     --orders path/to/Kindle.UnifiedLibraryIndex.CustomerOrders_FE.csv
 *
 * オプション:
 *   --merge  既存の books.json とマージする（デフォルト: 上書き）
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_JSON_PATH = path.join(__dirname, "..", "data", "books.json");

// --- CSV Parser ---

function parseCSV(content) {
  // Remove BOM if present
  const cleaned = content.replace(/^\uFEFF/, "");
  const lines = cleaned.split("\n");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip description row (Amazon exports often have a 2nd row with column descriptions)
    if (i === 1 && isDescriptionRow(line, headers.length)) continue;

    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function isDescriptionRow(line, headerCount) {
  const values = parseCSVLine(line);
  // If most values are long descriptions (>30 chars), it's likely a description row
  const longValues = values.filter((v) => v.length > 30);
  return longValues.length > headerCount / 2;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// --- Args ---

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { sessions: null, orders: null, merge: false, kindleDir: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sessions" && args[i + 1]) {
      parsed.sessions = args[++i];
    } else if (args[i] === "--orders" && args[i + 1]) {
      parsed.orders = args[++i];
    } else if (args[i] === "--metadata" && args[i + 1]) {
      // Backward compatibility
      parsed.orders = args[++i];
    } else if (args[i] === "--kindle-dir" && args[i + 1]) {
      parsed.kindleDir = args[++i];
    } else if (args[i] === "--merge") {
      parsed.merge = true;
    }
  }

  // Auto-detect files from --kindle-dir
  if (parsed.kindleDir) {
    const dir = parsed.kindleDir;

    if (!parsed.sessions) {
      const sessionPath = path.join(
        dir,
        "Kindle.Devices.ReadingSession",
        "Kindle.Devices.ReadingSession.csv"
      );
      if (fs.existsSync(sessionPath)) {
        parsed.sessions = sessionPath;
      }
    }

    if (!parsed.orders) {
      const ordersPath = path.join(
        dir,
        "Kindle.UnifiedLibraryIndex",
        "datasets",
        "Kindle.UnifiedLibraryIndex.CustomerOrders_FE",
        "Kindle.UnifiedLibraryIndex.CustomerOrders_FE.csv"
      );
      if (fs.existsSync(ordersPath)) {
        parsed.orders = ordersPath;
      }
    }
  }

  if (!parsed.sessions) {
    console.error("エラー: ReadingSession.csv が見つかりません");
    console.error();
    console.error("使い方:");
    console.error(
      "  node scripts/import-kindle-csv.mjs --kindle-dir ~/Downloads/Kindle"
    );
    console.error();
    console.error("または個別に指定:");
    console.error(
      "  node scripts/import-kindle-csv.mjs --sessions <ReadingSession.csv> --orders <CustomerOrders_FE.csv>"
    );
    process.exit(1);
  }

  return parsed;
}

// --- Helpers ---

function asinToSlug(asin) {
  return asin.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function findColumn(row, candidates) {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find(
      (k) => k.toLowerCase().includes(candidate.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

// --- Main ---

function main() {
  const args = parseArgs();

  // Parse ReadingSession CSV
  console.log(`読み込み中: ${args.sessions}`);
  const sessionsContent = fs.readFileSync(args.sessions, "utf-8");
  const sessionsRows = parseCSV(sessionsContent);

  if (sessionsRows.length === 0) {
    console.error("エラー: ReadingSession.csv にデータがありません");
    process.exit(1);
  }

  // Detect column names
  const sampleSession = sessionsRows[0];
  const colASIN_s = findColumn(sampleSession, ["ASIN", "asin"]) || "ASIN";
  const colStartTimestamp =
    findColumn(sampleSession, ["start_timestamp"]) || "start_timestamp";
  const colEndTimestamp =
    findColumn(sampleSession, ["end_timestamp"]) || "end_timestamp";
  const colReadingMillis =
    findColumn(sampleSession, ["total_reading_millis"]) ||
    "total_reading_millis";
  const colPageFlips =
    findColumn(sampleSession, ["number_of_page_flips"]) ||
    "number_of_page_flips";

  console.log(`  セッション数: ${sessionsRows.length}`);
  console.log();

  // Parse Orders CSV (for title lookup)
  const titleMap = new Map(); // ASIN -> title

  if (args.orders) {
    console.log(`読み込み中: ${args.orders}`);
    const ordersContent = fs.readFileSync(args.orders, "utf-8");
    const ordersRows = parseCSV(ordersContent);

    if (ordersRows.length > 0) {
      const sampleOrder = ordersRows[0];
      const colASIN_o =
        findColumn(sampleOrder, ["ASIN", "asin"]) || "ASIN";
      const colProductName =
        findColumn(sampleOrder, ["Product Name", "product_name", "title"]) ||
        "Product Name";

      console.log(`  書籍数: ${ordersRows.length}`);
      console.log();

      for (const row of ordersRows) {
        const asin = row[colASIN_o];
        const title = row[colProductName];
        if (asin && title) {
          titleMap.set(asin, title);
        }
      }
    }
  } else {
    console.log(
      "注意: CustomerOrders_FE.csv が見つかりません。タイトルはASINで表示されます。"
    );
    console.log();
  }

  // Group sessions by ASIN, then by date
  const bookSessions = new Map();

  for (const row of sessionsRows) {
    const asin = row[colASIN_s];
    if (!asin) continue;

    // Use end_timestamp if start_timestamp is "Not Available"
    let timestamp = row[colStartTimestamp];
    if (!timestamp || timestamp === "Not Available") {
      timestamp = row[colEndTimestamp];
    }
    if (!timestamp || timestamp === "Not Available") continue;

    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) continue;
    const date = parsed.toISOString().split("T")[0];

    const readingMillis = parseInt(row[colReadingMillis] || "0", 10) || 0;
    const pageFlips = parseInt(row[colPageFlips] || "0", 10) || 0;

    if (!bookSessions.has(asin)) {
      bookSessions.set(asin, new Map());
    }

    const dateSessions = bookSessions.get(asin);
    if (!dateSessions.has(date)) {
      dateSessions.set(date, { readingMillis: 0, pageFlips: 0 });
    }

    const existing = dateSessions.get(date);
    existing.readingMillis += readingMillis;
    existing.pageFlips += pageFlips;
  }

  // Build books array
  const books = [];

  for (const [asin, dateSessions] of bookSessions) {
    const title = titleMap.get(asin) || `不明 (${asin})`;

    // Sort dates chronologically
    const sortedDates = Array.from(dateSessions.keys()).sort();

    // Accumulate page flips to create currentPage
    let cumulativePages = 0;
    const sessions = [];

    for (const date of sortedDates) {
      const data = dateSessions.get(date);
      cumulativePages += data.pageFlips;
      const readingTimeMinutes = Math.round(data.readingMillis / 60000);

      sessions.push({
        date,
        currentPage: cumulativePages,
        ...(readingTimeMinutes > 0 ? { readingTimeMinutes } : {}),
      });
    }

    // Skip books with no meaningful sessions
    if (sessions.length === 0) continue;

    books.push({
      id: asinToSlug(asin),
      title,
      author: "",
      asin,
      progressType: "page",
      sessions,
    });
  }

  // Sort by last read date descending
  books.sort((a, b) => {
    const dateA = a.sessions[a.sessions.length - 1]?.date ?? "";
    const dateB = b.sessions[b.sessions.length - 1]?.date ?? "";
    return dateB.localeCompare(dateA);
  });

  // Merge with existing books.json if --merge
  let output = { books };

  if (args.merge && fs.existsSync(BOOKS_JSON_PATH)) {
    const existing = JSON.parse(fs.readFileSync(BOOKS_JSON_PATH, "utf-8"));
    const existingAsins = new Set(
      existing.books.filter((b) => b.asin).map((b) => b.asin)
    );
    const existingIds = new Set(existing.books.map((b) => b.id));

    const newBooks = books.filter(
      (b) => !existingIds.has(b.id) && !existingAsins.has(b.asin)
    );

    output = {
      books: [...existing.books, ...newBooks],
    };

    console.log(
      `マージ: 既存 ${existing.books.length}冊 + 新規 ${newBooks.length}冊`
    );
  }

  // Write books.json
  fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify(output, null, 2) + "\n");

  console.log(
    `完了: ${output.books.length}冊を ${BOOKS_JSON_PATH} に書き出しました`
  );

  // Summary
  const noTitle = output.books.filter((b) => b.title.startsWith("不明")).length;
  if (noTitle > 0) {
    console.log(`  タイトル不明: ${noTitle}冊`);
  }

  console.log();
  console.log("次のステップ:");
  console.log("  1. books.json を確認し、著者名 (author) を補完してください");
  console.log("  2. ISBNを追加すると表紙画像が自動取得されます");
  console.log(
    '  3. "currentPage" はページめくり数の累計です（実際のページ番号と異なる場合があります）'
  );
}

main();
