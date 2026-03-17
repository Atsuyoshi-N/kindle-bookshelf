import { Book } from "@/types/book";

// 1日10時間（600分）を超えるセッションは異常値として除外
const MAX_SESSION_MINUTES = 600;

export interface MonthlyData {
  month: string; // "2025-01"
  label: string; // "1月"
  totalMinutes: number;
  bookCount: number;
}

export interface YearlyData {
  year: number;
  label: string; // "2025"
  totalMinutes: number;
}

export function aggregateMonthlyData(books: Book[]): MonthlyData[] {
  const timeMap = new Map<string, number>();
  const bookMap = new Map<string, Set<string>>();

  for (const book of books) {
    for (const session of book.sessions) {
      const month = session.date.substring(0, 7); // "YYYY-MM"

      // Book count: any session counts (regardless of reading time)
      if (!bookMap.has(month)) bookMap.set(month, new Set());
      bookMap.get(month)!.add(book.id);

      // Reading time: exclude anomalous sessions
      if (!session.readingTimeMinutes || session.readingTimeMinutes > MAX_SESSION_MINUTES) continue;
      timeMap.set(month, (timeMap.get(month) ?? 0) + session.readingTimeMinutes);
    }
  }

  // Merge all months from both maps
  const allMonths = new Set([...timeMap.keys(), ...bookMap.keys()]);
  const sorted = Array.from(allMonths).sort();

  return sorted.map((month) => ({
    month,
    label: `${parseInt(month.substring(5), 10)}月`,
    totalMinutes: timeMap.get(month) ?? 0,
    bookCount: bookMap.get(month)?.size ?? 0,
  }));
}

export function aggregateTotalReadingTime(books: Book[]): number {
  let total = 0;
  for (const book of books) {
    for (const session of book.sessions) {
      if (!session.readingTimeMinutes || session.readingTimeMinutes > MAX_SESSION_MINUTES) continue;
      total += session.readingTimeMinutes;
    }
  }
  return total;
}

export function aggregateYearlyReadingTime(books: Book[]): YearlyData[] {
  const map = new Map<number, number>();

  for (const book of books) {
    for (const session of book.sessions) {
      if (!session.readingTimeMinutes || session.readingTimeMinutes > MAX_SESSION_MINUTES) continue;
      const year = new Date(session.date).getFullYear();
      map.set(year, (map.get(year) ?? 0) + session.readingTimeMinutes);
    }
  }

  const sorted = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);

  return sorted.map(([year, totalMinutes]) => ({
    year,
    label: String(year),
    totalMinutes,
  }));
}
