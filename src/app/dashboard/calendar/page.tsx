import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { requireWorkspace } from "@/lib/auth/dal";
import { APPLICATION_STATUS_LABELS } from "@/lib/workspace/constants";
import { getCalendarApplications } from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Application calendar",
  robots: { index: false, follow: false },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const session = await requireWorkspace();
  const applications = await getCalendarApplications(session.user.id);
  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() - 86400000);
  const firstDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1 - offset),
  );
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(start.getTime() + index * 86400000),
  );
  const eventsByDate = new Map<string, typeof applications>();
  for (const application of applications) {
    if (!application.deadline) continue;
    const key = dateKey(application.deadline);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), application]);
  }
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  const upcoming = applications
    .filter(
      (application) =>
        application.deadline && application.deadline >= upcomingCutoff,
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Student workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Application calendar
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Deadlines come from the dates you set in your application tracker.
        </p>
      </header>

      <section className="surface-card overflow-hidden">
        <div className="border-border flex items-center justify-between border-b p-4 sm:px-5">
          <h2 className="font-semibold">{monthLabel}</h2>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-4" /> {applications.length} dated
            applications
          </span>
        </div>
        <div className="border-border bg-muted/30 grid grid-cols-7 border-b">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-muted-foreground px-1 py-2 text-center text-[10px] font-semibold uppercase sm:px-2 sm:text-xs"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const events = eventsByDate.get(key) ?? [];
            const inMonth = day.getUTCMonth() === now.getUTCMonth();
            return (
              <div
                key={key}
                className={`border-border min-h-20 border-r border-b p-1 sm:min-h-28 sm:p-2 ${inMonth ? "" : "bg-muted/20"}`}
              >
                <span
                  className={`text-xs ${inMonth ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {day.getUTCDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {events.map((application) => (
                    <Link
                      key={application.id}
                      href={`/dashboard/applications/${application.id}`}
                      className="bg-primary/10 text-primary hover:bg-primary/15 block truncate rounded px-1 py-1 text-[9px] font-medium sm:text-[11px]"
                      title={`${application.university.name} · ${APPLICATION_STATUS_LABELS[application.status]}`}
                    >
                      {application.university.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Upcoming deadlines</h2>
        <div className="divide-border mt-3 divide-y">
          {upcoming.length ? (
            upcoming.map((application) => (
              <Link
                key={application.id}
                href={`/dashboard/applications/${application.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:underline"
              >
                <span className="font-medium">
                  {application.university.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {APPLICATION_STATUS_LABELS[application.status]}
                  </span>
                </span>
                <time
                  className="text-muted-foreground"
                  dateTime={application.deadline?.toISOString()}
                >
                  {application.deadline?.toLocaleDateString("en", {
                    timeZone: "UTC",
                  })}
                </time>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground py-4 text-sm">
              No upcoming deadlines. Add a date to an application to see it
              here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
