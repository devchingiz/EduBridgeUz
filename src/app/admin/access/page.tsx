import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PermissionControls } from "@/components/admin/permission-controls";
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
import { listAdminPermissionGrants } from "@/lib/admin/permission-grants";
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  rolePermissions,
} from "@/lib/admin/permissions";
import { listAdminUsers } from "@/lib/admin/users";
import { requireAdminPermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Access control",
  robots: { index: false, follow: false },
};

type SearchParams = { q?: string | string[]; page?: string | string[] };

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { admin } = await requireAdminPermission();
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 100);
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAdminUsers({ query, roles: ADMIN_ROLES, page });
  const grants = await listAdminPermissionGrants(
    result.users.map((user) => user.id),
  );

  const hrefForPage = (target: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/access${suffix ? `?${suffix}` : ""}`;
  };

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
          Access control
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          Role defaults and explicit user grants are enforced on the server. A
          Super Admin cannot grant administrator-role management to another
          account, and no administrator can change their own permissions here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role permissions</CardTitle>
          <CardDescription>
            Grants add capabilities on top of a role; they never remove role
            defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-left text-[12px]">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-[10.5px] font-medium tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Capability
                  </th>
                  {ADMIN_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="px-2 py-2 font-medium"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {ADMIN_PERMISSIONS.map((permission) => (
                  <tr key={permission}>
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {permission}
                    </td>
                    {ADMIN_ROLES.map((role) => {
                      const enabled =
                        rolePermissions(role).includes(permission);
                      return (
                        <td key={role} className="px-2 py-2">
                          {enabled ? (
                            <Badge variant="success">Allowed</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrator accounts</CardTitle>
          <CardDescription>
            Page {result.page} of {result.pageCount} · {result.total} accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/admin/access"
            className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search administrator name or email"
              maxLength={100}
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>

          {result.users.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No administrator accounts match this search.
            </p>
          ) : (
            <div className="space-y-3">
              {result.users.map((user) => {
                const userGrants = grants.get(user.id) ?? [];
                return (
                  <div
                    key={user.id}
                    className="rounded-xl border p-4 sm:flex sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-muted-foreground text-[11.5px]">
                        {user.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="brand">{ROLE_LABELS[user.role]}</Badge>
                        <Badge
                          variant={user.emailVerifiedAt ? "success" : "warning"}
                        >
                          {user.emailVerifiedAt ? "Verified" : "Unverified"}
                        </Badge>
                        {userGrants.map((grant) => (
                          <Badge key={grant} variant="muted">
                            {grant}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:w-72 sm:shrink-0">
                      <PermissionControls
                        userId={user.id}
                        grants={userGrants}
                        isSelf={user.id === admin.userId}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefForPage(result.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {result.page < result.pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefForPage(result.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
