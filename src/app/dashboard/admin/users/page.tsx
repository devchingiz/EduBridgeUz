import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

import {
  revokeUserSessionsAction,
  setUserRoleAction,
} from "@/app/dashboard/admin/actions";
import { UserRoleControls } from "@/components/admin/user-role-controls";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, listAdminUsers } from "@/lib/admin/users";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getBootstrapAdminEmails } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "User administration",
  robots: { index: false, follow: false },
};

type SearchParams = {
  q?: string | string[];
  role?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function usersHref(q: string, role: Role | null, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/dashboard/admin/users${query ? `?${query}` : ""}`;
}

const ROLE_VARIANTS: Record<Role, "brand" | "warning" | "muted"> = {
  ADMIN: "brand",
  REVIEWER: "warning",
  STUDENT: "muted",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["ADMIN"]);
  const params = await searchParams;

  const query = first(params.q).trim().slice(0, 100);
  const requestedRole = first(params.role);
  const role =
    ASSIGNABLE_ROLES.find((candidate) => candidate === requestedRole) ?? null;
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAdminUsers({ query, role, page });
  const bootstrapConfigured = getBootstrapAdminEmails().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Staff workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            User administration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Change account roles and sign out active sessions. Every change is
            written to the audit log.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to overview
        </Link>
      </div>

      {bootstrapConfigured ? (
        <Alert variant="info">
          <span>
            Bootstrap administrator emails are configured. Listed accounts are
            promoted when they sign in, so remove an address from the
            environment before demoting it here.
          </span>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Reviewers and administrators are staff. Students have no staff
            access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action="/dashboard/admin/users"
            method="get"
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search by name or email"
              aria-label="Search accounts by name or email"
              className="sm:max-w-xs"
            />
            <Select
              name="role"
              defaultValue={role ?? ""}
              aria-label="Filter by role"
              className="sm:w-44"
            >
              <option value="">All roles</option>
              {ASSIGNABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>

          {result.users.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No accounts match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Account
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Role
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Email
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Sessions
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Joined
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {result.users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-muted-foreground text-[11.5px]">
                          {user.id === session.user.id
                            ? "You"
                            : "Managed account"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={ROLE_VARIANTS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {user.emailVerifiedAt ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 tabular-nums">
                        {user.activeSessions}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="py-3">
                        <UserRoleControls
                          userId={user.id}
                          role={user.role}
                          isSelf={user.id === session.user.id}
                          activeSessions={user.activeSessions}
                          setRoleAction={setUserRoleAction}
                          revokeSessionsAction={revokeUserSessionsAction}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-[12px]">
              {result.total === 0
                ? "No accounts"
                : `Showing ${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}`}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={usersHref(query, role, result.page - 1)}>
                    Previous
                  </Link>
                </Button>
              ) : null}
              {result.page < result.pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={usersHref(query, role, result.page + 1)}>
                    Next
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-[12px] leading-5">
        Only administrators can open this page. Role checks are re-read from the
        database on every request, and role and session changes are append-only
        audit events.
      </p>
    </div>
  );
}
