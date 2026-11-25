import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { ScholarshipCsvImportForm } from "@/components/admin/scholarship-management-forms";
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
  ADMIN_SCHOLARSHIP_PAGE_SIZE,
  listAdminScholarships,
} from "@/lib/admin/scholarships";
import { requireAdminPermission } from "@/lib/auth/dal";
import {
  FUNDING_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  type FundingTypeValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { verificationBadgeVariant } from "@/lib/catalog/format";
import { countryName } from "@/lib/data/countries";

export const metadata: Metadata = {
  title: "Scholarship administration",
  robots: { index: false, follow: false },
};

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  featured?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function scholarshipsHref(
  query: string,
  status: VerificationStatusValue | null,
  featured: boolean | null,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (featured !== null) params.set("featured", featured ? "yes" : "no");
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/admin/scholarships${suffix ? `?${suffix}` : ""}`;
}

export default async function AdminScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { admin } = await requireAdminPermission("SCHOLARSHIPS_READ");
  const params = await searchParams;

  const query = first(params.q).trim().slice(0, 100);
  const requestedStatus = first(params.status);
  const status =
    VERIFICATION_STATUSES.find(
      (candidate): candidate is VerificationStatusValue =>
        candidate === requestedStatus,
    ) ?? null;
  const requestedFeatured = first(params.featured);
  const featured =
    requestedFeatured === "yes"
      ? true
      : requestedFeatured === "no"
        ? false
        : null;
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAdminScholarships({ query, status, featured, page });
  const canManage = admin.permissions.has("SCHOLARSHIPS_MANAGE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Administration overview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
            Scholarship administration
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Search all {result.total} catalog records, edit sourced profiles,
            and control publication, archiving, and featured discovery.
          </p>
        </div>
        {canManage ? (
          <Button asChild size="sm">
            <Link href="/admin/scholarships/new">
              <Plus aria-hidden="true" />
              New scholarship
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog records</CardTitle>
          <CardDescription>
            Page {result.page} of {result.pageCount}. Available actions depend
            on your granted capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/admin/scholarships"
            className="mb-4 grid gap-3 sm:grid-cols-4"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search name, provider or slug"
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
            <Select
              name="featured"
              defaultValue={featured === null ? "" : featured ? "yes" : "no"}
            >
              <option value="">All discovery</option>
              <option value="yes">Featured</option>
              <option value="no">Not featured</option>
            </Select>
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </form>

          {result.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No scholarships match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Scholarship
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Provider
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Funding
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Quality
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Featured
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/scholarships/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-muted-foreground text-[11px]">
                          {item.slug}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="whitespace-nowrap">
                          {item.providerName}
                        </span>
                        <p className="text-muted-foreground text-[11px]">
                          {item.hostCountryCode
                            ? countryName(item.hostCountryCode)
                            : "Multiple / unknown"}
                        </p>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                        {FUNDING_LABELS[item.fundingType as FundingTypeValue]}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={verificationBadgeVariant(item.status)}>
                          {VERIFICATION_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 tabular-nums">
                        {item.warningCount === 0 ? (
                          <Badge variant="success">Complete</Badge>
                        ) : (
                          <Badge variant="warning">
                            {item.warningCount} warning
                            {item.warningCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {item.featured ? (
                          <Badge variant="default">Featured</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                : `Showing ${(result.page - 1) * ADMIN_SCHOLARSHIP_PAGE_SIZE + 1}–${Math.min(result.page * ADMIN_SCHOLARSHIP_PAGE_SIZE, result.total)} of ${result.total}`}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={scholarshipsHref(
                      query,
                      status,
                      featured,
                      result.page - 1,
                    )}
                  >
                    Previous
                  </Link>
                </Button>
              ) : null}
              {result.page < result.pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={scholarshipsHref(
                      query,
                      status,
                      featured,
                      result.page + 1,
                    )}
                  >
                    Next
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {canManage ? <ScholarshipCsvImportForm /> : null}

      <p className="text-muted-foreground text-[12px] leading-5">
        Capability checks are re-read from the database on every request. Every
        catalog mutation writes an append-only audit event.
      </p>
    </div>
  );
}
