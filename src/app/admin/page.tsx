import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Award,
  ClipboardCheck,
  Coins,
  FileText,
  GraduationCap,
  MailCheck,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ActivityTrendChart } from "@/components/admin/activity-trend-chart";
import { StatusBreakdownChart } from "@/components/admin/status-breakdown-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrendMetric } from "@/lib/admin/analytics";
import { getAdminOverview } from "@/lib/admin/overview";
import { requireAdminPermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

type StatCard = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
};

function StatGrid({ stats }: { stats: readonly StatCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-3.5" />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {stat.value.toLocaleString("en")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-[12px]">{stat.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default async function AdminPage() {
  const { admin } = await requireAdminPermission();
  const overview = await getAdminOverview();

  const canReadUsers = admin.permissions.has("USERS_READ");
  const canReadUniversities = admin.permissions.has("UNIVERSITIES_READ");
  const canReadScholarships = admin.permissions.has("SCHOLARSHIPS_READ");
  const canReadApplications = admin.permissions.has("APPLICATIONS_READ");
  const canReadAI = admin.permissions.has("AI_READ");
  const canReadAudit = admin.permissions.has("AUDIT_READ");
  const canReadContent = admin.permissions.has("CONTENT_READ");
  const canReadCatalogHealth =
    canReadUniversities || canReadScholarships || canReadContent;

  const accessStats: StatCard[] = [
    {
      label: "Accounts",
      value: overview.totalUsers,
      detail: `${overview.verifiedUsers} verified email addresses`,
      icon: Users,
    },
    {
      label: "Under 18",
      value: overview.minorUsers,
      detail: `${overview.pendingGuardianConsents} awaiting guardian consent`,
      icon: ShieldCheck,
    },
    {
      label: "Active sessions",
      value: overview.activeSessions,
      detail: "Not revoked and unexpired",
      icon: Activity,
    },
    {
      label: "Verified email",
      value: overview.verifiedUsers,
      detail: `${overview.totalUsers - overview.verifiedUsers} still unverified`,
      icon: MailCheck,
    },
  ];

  const verifiedUniversities =
    overview.universityStatuses.find((item) => item.status === "VERIFIED")
      ?.count ?? 0;

  const platformStats: StatCard[] = [];
  if (canReadUniversities) {
    platformStats.push({
      label: "Universities",
      value: overview.totals.universities,
      detail: `${verifiedUniversities.toLocaleString("en")} marked verified`,
      icon: GraduationCap,
    });
  }
  if (canReadScholarships) {
    platformStats.push({
      label: "Scholarships",
      value: overview.totals.scholarships,
      detail: "Source-linked catalog records",
      icon: Award,
    });
  }
  if (canReadApplications) {
    platformStats.push({
      label: "Applications",
      value: overview.totals.applications,
      detail: "Student-owned tracker entries",
      icon: ClipboardCheck,
    });
  }
  if (canReadAI) {
    platformStats.push({
      label: "AI requests",
      value: overview.totals.advisorRequests,
      detail: `${overview.totals.advisorConversations.toLocaleString("en")} conversations · ${overview.totals.estimatedAdvisorCostUsd.toLocaleString("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 })} estimated`,
      icon: Sparkles,
    });
  }

  const availableTrendMetrics: TrendMetric[] = ["accounts"];
  if (canReadApplications) availableTrendMetrics.push("applications");
  if (canReadAudit) availableTrendMetrics.push("auditEvents");
  if (canReadAI) availableTrendMetrics.push("advisorRequests");

  const showStatusCharts =
    canReadUniversities || canReadScholarships || canReadApplications;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            EduBridge control center
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            Administration overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live counts and activity from the database, recalculated on every
            request. Every administrative mutation is authorized on the server
            and written to the audit log.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Badge variant="brand" className="w-fit">
            <ShieldEllipsis aria-hidden="true" />
            {ROLE_LABELS[admin.role]}
          </Badge>
          <p className="text-muted-foreground text-[11px] tabular-nums">
            Snapshot {formatDateTime(new Date(overview.generatedAt))}
          </p>
        </div>
      </div>

      <StatGrid stats={accessStats} />

      {platformStats.length > 0 ? <StatGrid stats={platformStats} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Activity trends</CardTitle>
          <CardDescription>
            Daily counts from real records. Toggle a series or range; quiet days
            remain zero instead of being filled with sample data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityTrendChart
            data={overview.trend}
            availableMetrics={availableTrendMetrics}
          />
        </CardContent>
      </Card>

      {showStatusCharts ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {canReadUniversities ? (
            <Card>
              <CardHeader>
                <CardTitle>University verification status</CardTitle>
                <CardDescription>
                  Select a bar to inspect the count or open the filtered
                  records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBreakdownChart
                  data={overview.universityStatuses}
                  baseHref="/admin/universities"
                  ariaLabel="Universities by verification status"
                />
              </CardContent>
            </Card>
          ) : null}

          {canReadScholarships ? (
            <Card>
              <CardHeader>
                <CardTitle>Scholarship verification status</CardTitle>
                <CardDescription>
                  Counts reflect the current catalog, not imported estimates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBreakdownChart
                  data={overview.scholarshipStatuses}
                  baseHref="/admin/scholarships"
                  ariaLabel="Scholarships by verification status"
                />
              </CardContent>
            </Card>
          ) : null}

          {canReadApplications ? (
            <Card>
              <CardHeader>
                <CardTitle>Application pipeline</CardTitle>
                <CardDescription>
                  Student-owned tracker entries by current status. No personal
                  application details are shown.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBreakdownChart
                  data={overview.applicationStatuses}
                  ariaLabel="Applications by status"
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {canReadCatalogHealth ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
              Catalog health
            </CardTitle>
            <CardDescription>
              Provenance and review signals from the same live database
              snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Verified records",
                  value: overview.catalogHealth.verifiedRecords,
                  detail: "Universities, programs, and scholarships",
                },
                {
                  label: "Expired reviews",
                  value: overview.catalogHealth.recordsWithExpiredReview,
                  detail: "Past their re-review window",
                },
                {
                  label: "Undated sources",
                  value: overview.catalogHealth.citationsWithoutVerification,
                  detail: "Citations without a verification date",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-border bg-muted/30 rounded-lg border px-3 py-2.5"
                >
                  <p className="text-muted-foreground text-[11px] font-medium uppercase">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {item.value.toLocaleString("en")}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(canReadUsers ||
        canReadContent ||
        canReadUniversities ||
        canReadScholarships ||
        admin.role === "SUPER_ADMIN") && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canReadUsers ? (
            <Card>
              <CardHeader>
                <CardTitle>User administration</CardTitle>
                <CardDescription>
                  Review accounts, active sessions, and role assignments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/users"
                  className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  <Users aria-hidden="true" className="size-4" />
                  Manage accounts
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {canReadContent ? (
            <Card>
              <CardHeader>
                <CardTitle>Homepage content</CardTitle>
                <CardDescription>
                  Edit controlled marketing copy and internal links. Saves are
                  validated, audited, and published immediately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/content"
                  className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  <FileText aria-hidden="true" className="size-4" />
                  Edit homepage
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {admin.role === "SUPER_ADMIN" ? (
            <Card>
              <CardHeader>
                <CardTitle>Access control</CardTitle>
                <CardDescription>
                  Assign administration roles and individual capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/access"
                  className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  <ShieldEllipsis aria-hidden="true" className="size-4" />
                  Manage access
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {canReadUniversities ? (
            <Card>
              <CardHeader>
                <CardTitle>University catalog</CardTitle>
                <CardDescription>
                  Search records and correct verification status. Sourced edits
                  remain in the review queue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/universities"
                  className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  <GraduationCap aria-hidden="true" className="size-4" />
                  Manage universities
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {canReadScholarships ? (
            <Card>
              <CardHeader>
                <CardTitle>Scholarship catalog</CardTitle>
                <CardDescription>
                  Search records and control publication, archiving, and
                  featured discovery.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/scholarships"
                  className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  <Award aria-hidden="true" className="size-4" />
                  Manage scholarships
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {admin.role === "ADMIN" || admin.role === "SUPER_ADMIN" ? (
        <Card>
          <CardHeader>
            <CardTitle>Catalog review</CardTitle>
            <CardDescription>
              Import, edit, and approve university, program, and scholarship
              records. Every fact needs an official source and verification
              date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/review"
              className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
            >
              <ClipboardCheck aria-hidden="true" className="size-4" />
              Open the review queue
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {canReadAudit ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent security events</CardTitle>
            <CardDescription>
              The last 25 audit events. Metadata and IP addresses stay hashed
              and are not shown here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recentEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No audit events recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Event
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Entity
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Actor
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        When
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {overview.recentEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="py-2.5 pr-4 font-medium whitespace-nowrap">
                          {event.action}
                        </td>
                        <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                          {event.entityType}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {event.actorName ?? "System"}
                        </td>
                        <td className="text-muted-foreground py-2.5 whitespace-nowrap">
                          {formatDateTime(event.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-[12px] leading-5">
        Charts and counts are re-read from the database on every request; no
        cached demo statistics are used. Administrator roles and permissions are
        re-checked on every request, and role changes are restricted to Super
        Admins.
      </p>
    </div>
  );
}
