"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  TREND_METRIC_COLORS,
  TREND_METRIC_LABELS,
  sliceTrend,
  type TrendMetric,
  type TrendPoint,
} from "@/lib/admin/analytics";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

export function ActivityTrendChart({
  data,
  availableMetrics,
}: {
  data: readonly TrendPoint[];
  availableMetrics: readonly TrendMetric[];
}) {
  const [range, setRange] = useState<RangeOption>(30);
  const [visible, setVisible] = useState<ReadonlySet<TrendMetric>>(
    () => new Set(availableMetrics),
  );

  const points = useMemo(() => sliceTrend(data, range), [data, range]);
  const activeMetrics = availableMetrics.filter((metric) =>
    visible.has(metric),
  );
  const totals = useMemo(() => {
    const result = Object.fromEntries(
      availableMetrics.map((metric) => [metric, 0]),
    ) as Record<TrendMetric, number>;
    for (const point of points) {
      for (const metric of availableMetrics) result[metric] += point[metric];
    }
    return result;
  }, [availableMetrics, points]);

  function toggleMetric(metric: TrendMetric) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  }

  if (availableMetrics.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No activity metrics are available for this role.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          aria-label="Visible activity series"
        >
          {availableMetrics.map((metric) => {
            const active = visible.has(metric);
            return (
              <button
                key={metric}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMetric(metric)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: TREND_METRIC_COLORS[metric] }}
                />
                {TREND_METRIC_LABELS[metric]}
                <span className="tabular-nums opacity-70">
                  {totals[metric].toLocaleString("en")}
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="bg-muted inline-flex rounded-lg p-0.5"
          aria-label="Chart range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                range === option
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-[260px] w-full"
        role="img"
        aria-label="Platform activity over time"
      >
        {activeMetrics.length === 0 ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Select a series to view activity.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                width={38}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  color: "var(--foreground)",
                  boxShadow: "0 12px 30px -20px rgb(15 23 42 / 0.5)",
                }}
                labelStyle={{
                  color: "var(--muted-foreground)",
                  fontSize: "11px",
                }}
              />
              {activeMetrics.map((metric) => (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={TREND_METRIC_LABELS[metric]}
                  stroke={TREND_METRIC_COLORS[metric]}
                  fill={TREND_METRIC_COLORS[metric]}
                  fillOpacity={0.1}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
