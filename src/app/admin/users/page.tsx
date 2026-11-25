import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@prisma/client";

import { AdminUserControls } from "@/components/admin/admin-user-controls";
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
import { listAdminUsers } from "@/lib/admin/users";
import { ASSIGNABLE_ROLES } from "@/lib/admin/permissions";
import { requireAdminPermission } from "@/lib/auth/dal";
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

function usersHref(query: string, role: Role | null, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (role) params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/admin/users${suffix ? `?${suffix}` : ""}`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { admin } = await requireAdminPermission("USERS_READ");
  const params = await searchParams;

  const query = first(params.q).trim().slice(0, 100);
  const requestedRole = first(params.role);
  const role =
    ASSIGNABLE_ROLES.find((candidate) => candidate === requestedRole) ?? null;
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAdminUsers({ query, role, page });
  const canManageRoles = admin.role === "SUPER_ADMIN";
  const canManageSessions = admin.permissions.has("USERS_MANAGE");
  const bootstrapConfigured = getBootstrapAdminEmails().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Administration overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
          User administration
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          Search accounts, review verification state, and manage roles. Only a
          Super Admin can change roles; passwords, hashes, and tokens are never
          displayed here.
        </p>
      </div>

      {bootstrapConfigured ? (
        <div
          role="status"
          className="border-warning/30 bg-warning/10 text-foreground rounded-lg border p-4 text-[12.5px] leading-6"
        >
          <strong className="font-semibold">Bootstrap mode is active.</strong>{" "}
          Listed emails are re-promoted to Super Admin on every successful
          sign-in. Remove `BOOTSTRAP_ADMIN_EMAILS` after bootstrap before
          demoting an account.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Page {result.page} of {result.pageCount} · {result.total} matching
            accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/admin/users"
            className="mb-4 grid gap-3 sm:grid-cols-3"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search name or email"
              maxLength={100}
            />
            <Select name="role" defaultValue={role ?? ""}>
              <option value="">All roles</option>
              {ASSIGNABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </form>

          {result.users.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No accounts match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Account
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Joined
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Sessions
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
                        <p className="text-muted-foreground text-[11px]">
                          {user.email}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="muted">
                            {ROLE_LABELS[user.role]}
                          </Badge>
                          <Badge
                            variant={
                              user.emailVerifiedAt ? "success" : "warning"
                            }
                          >
                            {user.emailVerifiedAt ? "Verified" : "Unverified"}
                          </Badge>
                        </div>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 tabular-nums">
                        {user.activeSessions}
                      </td>
                      <td className="py-3">
                        <AdminUserControls
                          userId={user.id}
                          role={user.role}
                          canManageRoles={canManageRoles}
                          canManageSessions={canManageSessions}
                          isSelf={user.id === admin.userId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-[12px]">
              {result.total === 0
                ? "No records"
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
    </div>
  );
}
