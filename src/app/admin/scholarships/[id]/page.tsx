import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  ScholarshipEditorForm,
  ScholarshipFeatureControl,
  ScholarshipSourceVerificationForm,
  ScholarshipStatusActions,
  type ScholarshipEditorValues,
} from "@/components/admin/scholarship-management-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminScholarship } from "@/lib/admin/scholarship-management";
import { requireAdminPermission } from "@/lib/auth/dal";
import {
  FUNDING_LABELS,
  VERIFICATION_LABELS,
  type FundingTypeValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";

export const metadata: Metadata = {
  title: "Edit scholarship",
  robots: { index: false, follow: false },
};

export default async function AdminScholarshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { admin } = await requireAdminPermission("SCHOLARSHIPS_READ");
  const { id } = await params;
  const detail = await getAdminScholarship(id);
  if (!detail) notFound();

  const canManage = admin.permissions.has("SCHOLARSHIPS_MANAGE");
  const editorValues: ScholarshipEditorValues = {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    providerName: detail.providerName,
    providerUrl: detail.providerUrl,
    hostCountryCode: detail.hostCountryCode ?? "",
    fundingType: detail.fundingType,
    degreeLevels: detail.degreeLevels,
    nationalityScope: detail.nationalityScope,
    eligibleNationalities: detail.eligibleNationalities,
    fieldScope: detail.fieldScope,
    fields: detail.fields,
    summary: detail.summary,
    status: detail.status as VerificationStatusValue,
    source: {
      url: detail.source.url,
      publisher: detail.source.publisher,
      title: detail.source.title,
      accessedAt: detail.source.accessedAt,
      verifiedAt: detail.source.verifiedAt ?? "",
      notes: detail.source.notes ?? "",
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/scholarships"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Scholarship catalog
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">
            {detail.name}
          </h1>
          <Badge>{VERIFICATION_LABELS[detail.status]}</Badge>
          {detail.featured ? <Badge variant="brand">Featured</Badge> : null}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {detail.providerName} · {detail.slug} ·{" "}
          {FUNDING_LABELS[detail.fundingType as FundingTypeValue] ??
            detail.fundingType}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12.5px]">
          {detail.hostCountryCode
            ? countryName(detail.hostCountryCode)
            : "Multiple / unknown host countries"}{" "}
          · {detail.requirementCount} requirement
          {detail.requirementCount === 1 ? "" : "s"} · {detail.deadlineCount}{" "}
          deadline{detail.deadlineCount === 1 ? "" : "s"}
        </p>
        <Link
          href={`/scholarships/${detail.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary mt-2 inline-flex items-center gap-1 text-[12.5px] hover:underline"
        >
          View public profile
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      {detail.warnings.length > 0 ? (
        <Alert variant="warning">
          <div className="space-y-1">
            <p className="font-medium">Missing information</p>
            <ul className="list-disc pl-5 text-[12.5px]">
              {detail.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : (
        <Alert variant="success">
          <span>No missing-information warnings for this record.</span>
        </Alert>
      )}

      {detail.duplicates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Possible duplicates</CardTitle>
            <CardDescription>
              These records share a normalised name and provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.duplicates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/admin/scholarships/${candidate.id}`}
                className="block rounded-md border px-3 py-2 text-sm hover:underline"
              >
                {candidate.name} — {candidate.providerName} ({candidate.slug})
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Publication controls</CardTitle>
              <CardDescription>
                Publishing requires a verified source. Restoring an archived
                record returns it to the unpublished state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScholarshipStatusActions
                id={detail.id}
                status={detail.status as VerificationStatusValue}
                featured={detail.featured}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Featured discovery</CardTitle>
                <CardDescription>
                  Featured records are pinned in public and AI-assisted
                  discovery. Only published, sourced records qualify.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScholarshipFeatureControl
                  id={detail.id}
                  featured={detail.featured}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Verify primary source</CardTitle>
                <CardDescription>
                  Record the date a reviewer checked the official source.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScholarshipSourceVerificationForm
                  id={detail.id}
                  verifiedAt={detail.source.verifiedAt ?? ""}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>
              Saving without publishing moves the record out of the verified
              state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScholarshipEditorForm values={editorValues} />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <span>
            You have read-only access to this catalog domain. A Scholarship
            Manager or Super Admin can change this record.
          </span>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
          <CardDescription>
            Most recent catalog decisions first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No decisions recorded.
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {detail.reviews.map((review) => (
                <li key={review.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{review.decision}</Badge>
                    <span className="text-muted-foreground text-[12px]">
                      {review.fromStatus ?? "none"} → {review.toStatus}
                    </span>
                    <span className="text-muted-foreground ml-auto text-[11px]">
                      {review.createdAt}
                    </span>
                  </div>
                  {review.note ? (
                    <p className="text-muted-foreground mt-1 text-[12.5px]">
                      {review.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
