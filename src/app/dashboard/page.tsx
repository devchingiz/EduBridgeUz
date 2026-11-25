import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  Search,
} from "lucide-react";
import Link from "next/link";

import { CatalogBenchmarkPanel } from "@/components/catalog/catalog-benchmark-panel";
import { DashboardScholarships } from "@/components/dashboard/dashboard-scholarships";
import { GateBanner } from "@/components/dashboard/gate-banner";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceStatus, requireUser } from "@/lib/auth/dal";
import { requireEmailVerification } from "@/lib/auth/verification-policy";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getCatalogBenchmarks } from "@/lib/catalog/benchmarks";
import {
  dashboardScholarshipSearchHref,
  hasActiveScholarshipFilters,
  parseScholarshipFilters,
} from "@/lib/catalog/filters";
import { listScholarships } from "@/lib/catalog/queries";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";
import {
  firstName,
  formatBudget,
  formatDate,
  relativeTime,
} from "@/lib/format";
import {
  getCalendarApplications,
  getWorkspaceAnalytics,
} from "@/lib/workspace/service";
import { APPLICATION_STATUS_LABELS } from "@/lib/workspace/constants";
import {
  URGENCY_LABELS,
  deadlineDistanceLabel,
  getDeadlineUrgency,
  isClosedStatus,
  type DeadlineUrgency,
} from "@/lib/workspace/application-board";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const STAGE_COLORS = [
  "bg-primary",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-400",
  "bg-slate-400",
] as const;

const URGENCY_TONES: Record<
  DeadlineUrgency,
  "warning" | "brand" | "secondary" | "muted"
> = {
  overdue: "warning",
  "due-soon": "warning",
  upcoming: "brand",
  later: "secondary",
  "no-deadline": "muted",
  closed: "muted",
};

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="bg-accent text-accent-foreground flex size-7 items-center justify-center rounded-lg">
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
        </div>
        <p className="mt-3 text-2xl leading-none font-semibold tracking-[-0.03em]">
          {value}
        </p>
        <p className="text-muted-foreground mt-2 text-[11px]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function deadlineParts(date: Date) {
  return {
    month: new Intl.DateTimeFormat("en", {
      month: "short",
      timeZone: "UTC",
    })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en", {
      day: "2-digit",
      timeZone: "UTC",
    }).format(date),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await requireUser();
  requireEmailVerification(session.user);
  const params = await searchParams;
  const benchmarksPromise = getCatalogBenchmarks();
  const status = await getWorkspaceStatus(session.user);
  const benchmarks = await benchmarksPromise;
  const profile = status.profile;
  const profileCompletionPercent = Math.round(
    [
      Boolean(profile?.nationality),
      Boolean(profile?.residenceCountry),
      Boolean(profile?.targetDegree),
      Boolean(profile?.fieldsOfStudy.length),
    ].filter(Boolean).length * 25,
  );

  const scholarshipFilters = parseScholarshipFilters({});
  if (profile?.nationality)
    scholarshipFilters.nationality = profile.nationality;
  if (profile?.targetDegree) scholarshipFilters.degree = profile.targetDegree;
  if (profile?.fieldsOfStudy.length) {
    scholarshipFilters.field = profile.fieldsOfStudy[0];
  }
  const scholarshipPromise = listScholarships(
    scholarshipFilters,
    session.user.id,
  );

  const [analytics, calendarApplications] = status.canUseWorkspace
    ? await Promise.all([
        getWorkspaceAnalytics(session.user.id),
        getCalendarApplications(session.user.id),
      ])
    : [null, []];
  const scholarships = await scholarshipPromise;
  const now = new Date();
  const todayUtc = new Date(now);
  todayUtc.setUTCHours(0, 0, 0, 0);
  const deadlineWindowUtc = new Date(todayUtc.getTime() + 30 * 86400000);
  const upcomingDeadlineCount = calendarApplications.filter(
    (application) =>
      application.deadline &&
      application.deadline >= todayUtc &&
      application.deadline <= deadlineWindowUtc &&
      !["ACCEPTED", "REJECTED"].includes(application.status),
  ).length;

  const steps = [
    {
      label: "Add your study preferences",
      done: status.profileComplete,
      href: "/dashboard/profile",
    },
    ...(status.isMinor
      ? [
          {
            label: "Record guardian consent",
            done: status.guardianConsentGranted,
            href: "/dashboard/guardian-consent",
          },
        ]
      : []),
  ];

  const completed = steps.filter((step) => step.done).length;
  const upcoming = calendarApplications
    .filter(
      (application) => application.deadline && application.deadline >= todayUtc,
    )
    .slice(0, 5);
  const quickLinks = [
    {
      href: "/dashboard/applications",
      label: "Applications",
      description: "Track stages and deadlines",
      icon: GraduationCap,
    },
    {
      href: "/dashboard/universities",
      label: "Explore universities",
      description: "Search the sourced catalog",
      icon: Search,
    },
    {
      href: "/dashboard/documents",
      label: "Documents",
      description: "Keep your files ready",
      icon: FileText,
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      description: "See what is coming up",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      {params.registered === "1" ? (
        <Alert variant="success">
          Your account is ready. Add your study preferences to personalize your
          workspace.
        </Alert>
      ) : null}

      <section className="border-primary/15 from-accent/80 via-card to-card relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8">
        <div
          className="hero-grid pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
        />
        <div
          className="bg-primary/10 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-xl">
            <p className="eyebrow">Student workspace · {formatDate(now)}</p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
              Welcome back, {firstName(session.user.name)}
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-6 sm:text-base">
              Your applications, private deadlines, and catalog context in one
              place. Member since {formatDate(session.user.createdAt)} ·{" "}
              {ROLE_LABELS[session.user.role]}.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button asChild size="sm">
                <Link href="/dashboard/applications">
                  Open application board <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/profile">
                  Edit profile <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="surface-card w-full max-w-sm shrink-0 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Getting started</p>
              <Badge
                variant={completed === steps.length ? "success" : "warning"}
              >
                {completed}/{steps.length} done
              </Badge>
            </div>
            <p className="mt-4 text-3xl leading-none font-semibold tracking-[-0.03em]">
              {profileCompletionPercent}%
            </p>
            <p className="text-muted-foreground mt-1.5 text-[12px]">
              Profile information added
            </p>
            <div
              className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Setup steps completed"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={completed}
            >
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{
                  width: `${steps.length ? (completed / steps.length) * 100 : 0}%`,
                }}
              />
            </div>
            <ul className="mt-4 space-y-2.5">
              {steps.map((step) => (
                <li key={step.label} className="flex items-start gap-2.5">
                  {step.done ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  ) : (
                    <Circle
                      aria-hidden="true"
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}
                    >
                      {step.label}
                    </p>
                    {!step.done ? (
                      <Link
                        href={step.href}
                        className="text-muted-foreground hover:text-foreground text-[12px] underline underline-offset-2"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <GateBanner status={status} />

      <section
        aria-label="Quick actions"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface-card group hover:border-primary/40 flex min-w-0 items-center gap-3 p-3.5 transition-colors"
          >
            <span className="bg-muted group-hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
                {label}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {description}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </section>

      {analytics ? (
        <>
          <section className="space-y-4">
            <SectionHeading
              eyebrow="At a glance"
              title="Your workspace"
              description="Private tracker data — your own notes, statuses, and saved deadlines."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={GraduationCap}
                label="Active applications"
                value={analytics.activeApplications}
                detail={`${analytics.totalApplications} tracked in total`}
              />
              <StatTile
                icon={CalendarClock}
                label="Deadlines in 30 days"
                value={upcomingDeadlineCount}
                detail="From dates you saved"
              />
              <StatTile
                icon={FileText}
                label="Documents complete"
                value={`${analytics.completedDocuments}/${analytics.documentCount}`}
                detail="Private document library"
              />
              <StatTile
                icon={BarChart3}
                label="Average progress"
                value={`${analytics.averageProgress}%`}
                detail="Across tracked applications"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 aria-hidden="true" className="size-4" />
                  Application stages
                </CardTitle>
                <CardDescription>
                  {analytics.totalApplications} tracked applications · based on
                  your saved tracker data.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                {analytics.statusCounts.length ? (
                  <>
                    <div
                      className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
                      role="img"
                      aria-label="Distribution of applications across stages"
                    >
                      {analytics.statusCounts.map(
                        ({ status: itemStatus, count }, index) => (
                          <div
                            key={itemStatus}
                            className={
                              STAGE_COLORS[index % STAGE_COLORS.length]
                            }
                            style={{
                              width: `${(count / analytics.totalApplications) * 100}%`,
                            }}
                            title={`${APPLICATION_STATUS_LABELS[itemStatus]}: ${count}`}
                          />
                        ),
                      )}
                    </div>
                    <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                      {analytics.statusCounts.map(
                        ({ status: itemStatus, count }, index) => (
                          <li
                            key={itemStatus}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={`size-2 rounded-full ${STAGE_COLORS[index % STAGE_COLORS.length]}`}
                              aria-hidden="true"
                            />
                            <span className="font-medium">
                              {APPLICATION_STATUS_LABELS[itemStatus]}
                            </span>
                            <span className="text-muted-foreground">
                              {count}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Add a university to start tracking applications.
                  </p>
                )}
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/dashboard/applications">
                    Open application board <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  Upcoming deadlines
                </CardTitle>
                <CardDescription>
                  Dates you added to your applications, soonest first.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                {upcoming.length ? (
                  <ul className="divide-border divide-y">
                    {upcoming.map((application) => {
                      const parts = application.deadline
                        ? deadlineParts(application.deadline)
                        : null;
                      const urgency = getDeadlineUrgency(
                        application.deadline,
                        application.status,
                        now,
                      );

                      return (
                        <li key={application.id}>
                          <Link
                            href={`/dashboard/applications/${application.id}`}
                            className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                          >
                            {parts && application.deadline ? (
                              <span className="border-border bg-muted/50 flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border">
                                <span className="text-muted-foreground text-[9px] font-semibold tracking-wide">
                                  {parts.month}
                                </span>
                                <span className="text-sm leading-none font-semibold">
                                  {parts.day}
                                </span>
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="group-hover:text-primary block truncate text-[13px] font-medium transition-colors">
                                {application.university.name}
                              </span>
                              <span className="text-muted-foreground block truncate text-[11px]">
                                {APPLICATION_STATUS_LABELS[application.status]}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <Badge variant={URGENCY_TONES[urgency]}>
                                {URGENCY_LABELS[urgency]}
                              </Badge>
                              <span className="text-muted-foreground mt-1 block text-[10px]">
                                {isClosedStatus(application.status)
                                  ? "Outcome recorded"
                                  : deadlineDistanceLabel(
                                      application.deadline,
                                      now,
                                    )}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No upcoming dates. Add one to an application.
                  </p>
                )}
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/dashboard/calendar">
                    Open calendar <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {analytics.recentEvents.length ? (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClockIcon />
                    Recent application activity
                  </CardTitle>
                  <CardDescription>
                    Status changes in your tracker, newest first.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-border divide-y">
                    {analytics.recentEvents.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-lg">
                          <ArrowRight
                            aria-hidden="true"
                            className="text-muted-foreground size-3.5"
                          />
                        </span>
                        <Link
                          href={`/dashboard/applications/${event.application.id}`}
                          className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline"
                        >
                          {event.application.university.name}
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            → {APPLICATION_STATUS_LABELS[event.toStatus]}
                          </span>
                        </Link>
                        <time
                          className="text-muted-foreground shrink-0 text-[11px]"
                          dateTime={event.createdAt.toISOString()}
                          title={formatDate(event.createdAt)}
                        >
                          {relativeTime(event.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Catalog benchmark"
          title="What the catalog can estimate"
          description="Derived estimates from source-bearing catalog records, not university-specific offers."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/universities">
                Explore universities <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <CatalogBenchmarkPanel benchmarks={benchmarks} variant="compact" />
      </section>

      <DashboardScholarships
        items={scholarships.items.slice(0, 3)}
        total={scholarships.total}
        searchHref={dashboardScholarshipSearchHref(scholarshipFilters)}
        personalized={hasActiveScholarshipFilters(scholarshipFilters)}
      />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck aria-hidden="true" className="size-4" />
              Study profile
            </CardTitle>
            <CardDescription>
              Preferences stay with your applications and discovery tools.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {profileCompletionPercent}% complete
          </Badge>
        </CardHeader>
        <CardContent>
          {profile ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Nationality",
                  value: profile.nationality
                    ? countryName(profile.nationality)
                    : "Not set",
                },
                {
                  label: "Country of residence",
                  value: profile.residenceCountry
                    ? countryName(profile.residenceCountry)
                    : "Not set",
                },
                {
                  label: "Target degree",
                  value: profile.targetDegree
                    ? degreeLabel(profile.targetDegree)
                    : "Not set",
                },
                {
                  label: "Budget",
                  value: formatBudget(
                    profile.budgetAmount,
                    profile.budgetCurrency,
                  ),
                },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium">
                    {item.value}
                  </p>
                </div>
              ))}
              <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Fields of study
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {profile.fieldsOfStudy.length ? (
                    profile.fieldsOfStudy.map((field) => (
                      <Badge key={field} variant="brand">
                        {field}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-[13px]">
                      Not set
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No profile yet. Add your study preferences to get started.
            </p>
          )}
          <Button asChild variant="outline" size="sm" className="mt-5">
            <Link href="/dashboard/profile">Update profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
