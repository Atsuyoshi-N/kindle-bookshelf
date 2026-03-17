"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { MonthlyData } from "@/lib/stats";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}

interface Props {
  data: MonthlyData[];
}

export function MonthlyChart({ data }: Props) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const d of data) {
      set.add(parseInt(d.month.substring(0, 4), 10));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const [selectedYear, setSelectedYear] = useState<number | null>(
    years[0] ?? null
  );

  const filtered = useMemo(() => {
    if (selectedYear === null) return data;
    return data.filter(
      (d) => parseInt(d.month.substring(0, 4), 10) === selectedYear
    );
  }, [data, selectedYear]);

  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        ...d,
        hours: Math.round((d.totalMinutes / 60) * 10) / 10,
      })),
    [filtered]
  );

  const TimeTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyData }> }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div className="bg-card-bg border border-card-border rounded px-3 py-2 shadow text-sm">
          <p className="font-medium">{d.month}</p>
          <p className="text-muted">{formatMinutes(d.totalMinutes)}</p>
        </div>
      );
    },
    []
  );

  const CountTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyData }> }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div className="bg-card-bg border border-card-border rounded px-3 py-2 shadow text-sm">
          <p className="font-medium">{d.month}</p>
          <p className="text-muted">{d.bookCount}冊</p>
        </div>
      );
    },
    []
  );

  const xAxisInterval = selectedYear ? 0 : "preserveStartEnd";

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedYear(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedYear === null
              ? "bg-accent text-white"
              : "bg-card-bg border border-card-border text-foreground hover:bg-card-border"
          }`}
        >
          すべて
        </button>
        {years.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedYear === year
                ? "bg-accent text-white"
                : "bg-card-bg border border-card-border text-foreground hover:bg-card-border"
            }`}
          >
            {year}年
          </button>
        ))}
      </div>

      <p className="text-xs text-muted mb-1">読書時間</p>
      <div className="h-52 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            syncId="monthly"
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={xAxisInterval}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v}h`}
              width={40}
            />
            <Tooltip content={<TimeTooltip />} />
            <Bar
              dataKey="hours"
              fill="var(--color-accent)"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted mb-1 mt-6">読書冊数</p>
      <div className="h-44 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            syncId="monthly"
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={xAxisInterval}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v}冊`}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={<CountTooltip />} />
            <Bar
              dataKey="bookCount"
              fill="var(--color-accent)"
              opacity={0.6}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
