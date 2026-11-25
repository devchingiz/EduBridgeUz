"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import type { StatusBreakdownItem } from "@/lib/admin/analytics";

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type BarClickPayload = {
  status?: string;
  payload?: { status?: string };
};

function statusFromPayload(payload: unknown): string | null {
  const candidate = payload as BarClickPayload;
  return candidate.status ?? candidate.payload?.status ?? null;
}

export function StatusBreakdownChart({
  data,
  baseHref,
  ariaLabel,
}: {
  data: readonly StatusBreakdownItem[];
  baseHref?: string;
  ariaLabel: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const fallback = [...data].sort((a, b) => b.count - a.count)[0] ?? null;
  const selected =
    data.find((item) => item.status === selectedStatus) ?? fallback;

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No records are available for this breakdown.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="w-full"
        style={{ height: Math.max(240, data.length * 34) }}
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as StatusBreakdownItem[]}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={134}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                fontSize: "12px",
                color: "var(--foreground)",
                boxShadow: "0 12px 30px -20px rgb(15 23 42 / 0.5)",
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              onClick={(payload: unknown) => {
                const status = statusFromPayload(payload);
                if (status) setSelectedStatus(status);
              }}
              className="cursor-pointer"
            >
              {data.map((item, index) => (
                <Cell
                  key={item.status}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                  opacity={
                    selected?.status === item.status || selectedStatus === null
                      ? 1
                      : 0.55
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected ? (
        <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <p className="text-[12.5px]">
            <span className="font-medium">{selected.label}</span>
            <span className="text-muted-foreground">
              {" · "}
              {selected.count.toLocaleString("en")}{" "}
              {selected.count === 1 ? "record" : "records"}
            </span>
          </p>
          {baseHref ? (
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-7 px-0 text-[12px]"
            >
              <Link
                href={`${baseHref}?status=${encodeURIComponent(selected.status)}`}
              >
                View filtered records
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
