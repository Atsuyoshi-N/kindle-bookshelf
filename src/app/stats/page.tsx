import Link from "next/link";
import { getAllBooks } from "@/lib/books";
import {
  aggregateMonthlyData,
  aggregateYearlyReadingTime,
  aggregateTotalReadingTime,
} from "@/lib/stats";
import { MonthlyChart } from "./monthly-chart";
import { YearlyChart } from "./yearly-chart";

export const metadata = {
  title: "統計 - My Kindle Bookshelf",
  description: "読書統計",
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}

export default async function StatsPage() {
  const books = await getAllBooks();
  const monthlyData = aggregateMonthlyData(books);
  const yearlyData = aggregateYearlyReadingTime(books);

  const totalMinutes = aggregateTotalReadingTime(books);
  const totalSessions = books.reduce(
    (sum, b) => sum + b.sessions.length,
    0
  );
  const booksWithTime = books.filter((b) => b.totalReadingTimeMinutes > 0);

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center text-sm text-accent hover:underline mb-6"
      >
        &larr; 本棚に戻る
      </Link>

      <h1 className="text-2xl font-bold mb-6">読書統計</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">総読書時間</p>
          <p className="text-lg sm:text-xl font-bold mt-1">
            {formatMinutes(totalMinutes)}
          </p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">読書セッション</p>
          <p className="text-lg sm:text-xl font-bold mt-1">
            {totalSessions.toLocaleString()}回
          </p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">総冊数</p>
          <p className="text-lg sm:text-xl font-bold mt-1">
            {books.length}冊
          </p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">読書時間記録あり</p>
          <p className="text-lg sm:text-xl font-bold mt-1">
            {booksWithTime.length}冊
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">月別読書時間・冊数</h2>
        <p className="text-xs text-muted mb-4">
          読書時間はセッション単位で集計（10時間超の異常値は除外）、冊数はその月にセッションのあったユニーク冊数
        </p>
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-5">
          <MonthlyChart data={monthlyData} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">年別読書時間の推移</h2>
        <p className="text-xs text-muted mb-4">
          読書時間が記録されたセッションのみ集計
        </p>
        <div className="bg-card-bg border border-card-border rounded-lg p-3 sm:p-5">
          <YearlyChart data={yearlyData} />
        </div>
      </section>
    </div>
  );
}
