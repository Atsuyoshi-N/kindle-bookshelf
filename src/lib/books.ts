import fs from "fs";
import path from "path";
import { Book, BookData, ComputedSession } from "@/types/book";

const PLACEHOLDER_COVER = "/placeholder-cover.svg";

function buildAmazonCoverUrl(asin: string): string {
  return `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX300_.jpg`;
}

interface BooksJson {
  books: BookData[];
}

function loadBooksJson(): BookData[] {
  const filePath = path.join(process.cwd(), "data", "books.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: BooksJson = JSON.parse(raw);
  return data.books;
}

function computeSessions(book: BookData): ComputedSession[] {
  const sorted = [...book.sessions].sort((a, b) => {
    const roundA = a.round ?? 1;
    const roundB = b.round ?? 1;
    if (roundA !== roundB) return roundA - roundB;
    return a.date < b.date ? -1 : 1;
  });

  const result: ComputedSession[] = [];

  if (book.progressType === "percent") {
    let prevPercent = 0;
    let prevRound = 0;

    for (const session of sorted) {
      const round = session.round ?? 1;
      if (round !== prevRound) {
        prevPercent = 0;
        prevRound = round;
      }
      const current = session.currentPercent ?? 0;
      result.push({
        date: session.date,
        currentPercent: current,
        percentRead: Math.round((current - prevPercent) * 10) / 10,
        readingTimeMinutes: session.readingTimeMinutes,
        round,
      });
      prevPercent = current;
    }
  } else {
    let prevPage = 0;
    let prevRound = 0;

    for (const session of sorted) {
      const round = session.round ?? 1;
      if (round !== prevRound) {
        prevPage = 0;
        prevRound = round;
      }
      const current = session.currentPage ?? 0;
      result.push({
        date: session.date,
        currentPage: current,
        pagesRead: current - prevPage,
        readingTimeMinutes: session.readingTimeMinutes,
        round,
      });
      prevPage = current;
    }
  }

  return result;
}

export function getAllBooks(): Book[] {
  const booksData = loadBooksJson();

  const books: Book[] = booksData.map((bookData) => {
    const resolvedCoverUrl = bookData.asin
      ? buildAmazonCoverUrl(bookData.asin)
      : bookData.coverUrl ?? PLACEHOLDER_COVER;

    const computedSessions = computeSessions(bookData);
    const lastSession =
      computedSessions.length > 0
        ? computedSessions[computedSessions.length - 1]
        : null;

    const currentRound = lastSession?.round ?? 1;

    const totalPagesRead = computedSessions.reduce(
      (sum, s) => sum + (s.pagesRead ?? 0),
      0
    );
    const completedRounds =
      bookData.totalPages && bookData.totalPages > 0
        ? Math.floor(totalPagesRead / bookData.totalPages)
        : 0;

    const totalReadingTimeMinutes = computedSessions.reduce(
      (sum, s) => sum + (s.readingTimeMinutes ?? 0),
      0
    );

    return {
      ...bookData,
      resolvedCoverUrl,
      lastReadDate: lastSession?.date ?? "",
      currentPage: lastSession?.currentPage,
      currentPercent: lastSession?.currentPercent,
      currentRound,
      completedRounds,
      totalReadingTimeMinutes,
      computedSessions,
    };
  });

  books.sort((a, b) => (a.lastReadDate > b.lastReadDate ? -1 : 1));

  return books;
}

export function getBookById(id: string): Book | undefined {
  return getAllBooks().find((b) => b.id === id);
}
