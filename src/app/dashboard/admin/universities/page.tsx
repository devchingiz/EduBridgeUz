import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { UniversityStatusControl } from "@/components/admin/university-status-control";
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
import {
  ADMIN_UNIVERSITY_PAGE_SIZE,
  ASSIGNABLE_UNIVERSITY_STATUSES,
  listAdminUniversities,
} from "@/lib/admin/universities";
import { requireRole } from "@/lib/auth/dal";
import {
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";
import { verificationBadgeVariant } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "University administration",
  robots: { index: false, follow: false },
};

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function universitiesHref(
  query: string,
  status: VerificationStatusValue | null,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/dashboard/admin/universities${suffix ? `?${suffix}` : ""}`;
}

export default async function AdminUniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;

  const query = first(params.q).trim().slice(0, 100);
  const requestedStatus = first(params.status);
  const status =
    VERIFICATION_STATUSES.find(
      (candidate): candidate is VerificationStatusValue =>
        candidate === requestedStatus,
    ) ?? null;
  const parsedPage = Number.parseInt(first(params.page), 10);
  const requestedPage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAdminUniversities({
    query,
    status,
    page: requestedPage,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/admin"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Operations overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
          University administration
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Search all {result.total} catalog records and correct their
          verification status. Every change is audited; reviewers should use the
          review queue to edit sourced facts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog records</CardTitle>
          <CardDescription>
            Page {result.page} of {result.pageCount}. Status overrides do not
            set a verification date or source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/dashboard/admin/universities"
            className="mb-4 grid gap-3 sm:grid-cols-3"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search name, slug or city"
              maxLength={100}
            />
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {VERIFICATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {VERIFICATION_LABELS[option]}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </form>

          {result.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No universities match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      University
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Location
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      QS 2027
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Programs
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/universities/${item.slug}`}
                          className="font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-muted-foreground text-[11px]">
                          {item.slug}
                        </p>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                        {item.city}, {countryName(item.countryCode)}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 tabular-nums">
                        {item.rankingDisplay ?? "Unavailable"}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 tabular-nums">
                        {item.programCount}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={verificationBadgeVariant(item.status)}
                          >
                            {VERIFICATION_LABELS[item.status]}
                          </Badge>
                          <UniversityStatusControl
                            universityId={item.id}
                            status={item.status}
                            options={ASSIGNABLE_UNIVERSITY_STATUSES}
                          />
                        </div>
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
                : `Showing ${(result.page - 1) * ADMIN_UNIVERSITY_PAGE_SIZE + 1}–${Math.min(result.page * ADMIN_UNIVERSITY_PAGE_SIZE, result.total)} of ${result.total}`}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={universitiesHref(query, status, result.page - 1)}>
                    Previous
                  </Link>
                </Button>
              ) : null}
              {result.page < result.pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={universitiesHref(query, status, result.page + 1)}>
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
        database on every request, and each status change writes an append-only
        audit event.
      </p>
    </div>
  );
}
