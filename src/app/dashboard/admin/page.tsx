import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ClipboardCheck,
  MailCheck,
  ShieldCheck,
  ShieldEllipsis,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminOverview } from "@/lib/admin/overview";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Operations",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await requireRole(["REVIEWER", "ADMIN"]);
  const overview = await getAdminOverview();

  const stats = [
    {
      label: "Accounts",
      value: overview.totalUsers,
      detail: `${overview.verifiedUsers} verified`,
      icon: Users,
    },
    {
      label: "Under 18",
      value: overview.minorUsers,
      detail: `${overview.pendingGuardianConsents} awaiting consent`,
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
      detail: "Confirmed addresses",
      icon: MailCheck,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Staff workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            Operations overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Account health, recent security events, and administration tools.
          </p>
        </div>
        <Badge variant="brand" className="w-fit">
          <ShieldEllipsis aria-hidden="true" />
          {ROLE_LABELS[session.user.role]}
        </Badge>
      </div>

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
                <p className="text-muted-foreground text-[12px]">
                  {stat.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent security events</CardTitle>
          <CardDescription>
            The last 25 audit events. Metadata and IP addresses stay hashed and
            are not shown here.
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

      {session.user.role === "ADMIN" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>User administration</CardTitle>
              <CardDescription>
                Assign roles, review active sessions, and sign accounts out.
                Administrators only; every change is audited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard/admin/users"
                className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
              >
                <Users aria-hidden="true" className="size-4" />
                Manage accounts
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>University administration</CardTitle>
              <CardDescription>
                Search all catalog records and correct verification status.
                Administrators only; every override is audited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard/admin/universities"
                className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
              >
                <ClipboardCheck aria-hidden="true" className="size-4" />
                Manage universities
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Catalog review</CardTitle>
          <CardDescription>
            Import, edit, and approve university, program, and scholarship
            records. Every fact needs an official source and verification date.
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

      <p className="text-muted-foreground text-[12px] leading-5">
        Catalog review tools require a reviewer or administrator role. Account
        role changes are administrator-only and re-checked on every request.
      </p>
    </div>
  );
}
