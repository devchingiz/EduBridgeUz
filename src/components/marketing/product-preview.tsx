"use client";

import {
  Award,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";

const progressData = [
  { stage: "Profile", readiness: 28 },
  { stage: "Shortlist", readiness: 46 },
  { stage: "Documents", readiness: 58 },
  { stage: "Submit", readiness: 76 },
  { stage: "Ready", readiness: 88 },
];

const sidebarItems = [
  { icon: LayoutDashboard, active: true, label: "Dashboard" },
  { icon: Building2, active: false, label: "Universities" },
  { icon: ClipboardList, active: false, label: "Applications" },
  { icon: FileText, active: false, label: "Documents" },
  { icon: CalendarDays, active: false, label: "Calendar" },
];

const deadlines = [
  {
    name: "Application documents",
    detail: "Sample · 4 of 6 ready",
    date: "Nov 28",
    tone: "bg-amber-500",
  },
  {
    name: "Scholarship essay",
    detail: "Sample · Draft saved",
    date: "Dec 05",
    tone: "bg-indigo-500",
  },
];

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] lg:mx-0">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/12 via-sky-400/8 to-transparent blur-2xl"
      />

      <div className="border-border/80 bg-card/95 relative overflow-hidden rounded-2xl border shadow-[0_30px_90px_-45px_rgb(49_46_129/0.55)] backdrop-blur-sm">
        <div className="border-border bg-muted/45 flex h-10 items-center gap-2 border-b px-3.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-rose-400/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
          </div>
          <div className="border-border/80 bg-card text-muted-foreground mx-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9.5px]">
            <Lock className="size-2.5" aria-hidden="true" />
            app.edubridge
          </div>
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[9px] font-normal"
          >
            Preview
          </Badge>
        </div>

        <div className="flex">
          <aside
            aria-hidden="true"
            className="border-border/70 bg-muted/20 hidden w-12 shrink-0 flex-col items-center gap-1.5 border-r py-3 sm:flex"
          >
            {sidebarItems.map((item) => (
              <span
                key={item.label}
                title={item.label}
                className={
                  item.active
                    ? "bg-accent text-primary flex size-8 items-center justify-center rounded-md"
                    : "text-muted-foreground/70 flex size-8 items-center justify-center rounded-md"
                }
              >
                <item.icon className="size-3.5" />
              </span>
            ))}
            <span className="text-muted-foreground/60 mt-auto flex size-8 items-center justify-center rounded-md">
              <Bell className="size-3.5" />
            </span>
          </aside>

          <div className="min-w-0 flex-1 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground font-mono text-[8.5px] tracking-[0.16em] uppercase">
                  Sample workspace
                </p>
                <p className="mt-0.5 text-[13px] font-semibold tracking-[-0.01em]">
                  Good evening, Amina
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <p className="text-muted-foreground text-[8.5px]">Profile</p>
                  <div className="bg-muted mt-1 h-1 w-16 overflow-hidden rounded-full">
                    <div className="bg-primary h-full w-[78%] rounded-full" />
                  </div>
                </div>
                <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-[9.5px] font-semibold">
                  AS
                </span>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {[
                {
                  label: "Active applications",
                  value: "4",
                  icon: ClipboardList,
                },
                { label: "Next deadline", value: "Nov 28", icon: CalendarDays },
                { label: "Documents ready", value: "6 / 8", icon: FileText },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border-border/80 bg-card rounded-lg border p-2.5"
                >
                  <stat.icon
                    className="text-muted-foreground size-3"
                    aria-hidden="true"
                  />
                  <p className="mt-1.5 text-[15px] leading-none font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-[8.5px]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-border/80 bg-card mt-2.5 rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-tight">
                    Application readiness
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[8.5px]">
                    Profile to submission
                  </p>
                </div>
                <Badge
                  variant="muted"
                  className="h-4 border-0 px-1.5 text-[8px] font-normal"
                >
                  Sample data
                </Badge>
              </div>
              <div className="mt-1 h-[92px] w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    accessibilityLayer={false}
                    data={progressData}
                    margin={{ top: 8, right: 2, bottom: 0, left: 2 }}
                  >
                    <defs>
                      <linearGradient
                        id="readiness-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="stage"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 8.5, fill: "var(--muted-foreground)" }}
                      dy={4}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "10px",
                        color: "var(--foreground)",
                        boxShadow: "0 8px 24px -16px rgb(15 23 42 / 0.4)",
                      }}
                      labelStyle={{
                        color: "var(--muted-foreground)",
                        fontSize: "9px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="readiness"
                      stroke="var(--chart-1)"
                      strokeWidth={1.8}
                      fill="url(#readiness-fill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {deadlines.map((deadline) => (
                <div
                  key={deadline.name}
                  className="border-border/80 bg-card flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${deadline.tone}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-medium">
                      {deadline.name}
                    </p>
                    <p className="text-muted-foreground truncate text-[8px]">
                      {deadline.detail}
                    </p>
                  </div>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 text-[8.5px] font-medium">
                    {deadline.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-border/80 bg-card absolute -bottom-5 -left-2 hidden w-[13.5rem] rounded-xl border p-3 shadow-[0_18px_50px_-28px_rgb(15_23_42/0.45)] sm:block">
        <div className="flex items-start gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold">Source verified</p>
            <p className="text-muted-foreground mt-0.5 text-[8.5px] leading-3.5">
              Official page attached to every requirement.
            </p>
          </div>
        </div>
        <div className="bg-border mt-2 h-px" />
        <div className="text-muted-foreground mt-2 flex items-center justify-between text-[8.5px]">
          <span className="inline-flex items-center gap-1">
            <Award className="size-2.5" aria-hidden="true" />
            Scholarship check
          </span>
          <span className="text-primary inline-flex items-center gap-1">
            <Sparkles className="size-2.5" aria-hidden="true" />
            AI-ready
          </span>
        </div>
      </div>
    </div>
  );
}
