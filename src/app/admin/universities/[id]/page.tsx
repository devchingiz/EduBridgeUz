import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  UniversityEditorForm,
  UniversityFeatureControl,
  UniversitySourceVerificationForm,
  UniversityStatusActions,
  type UniversityEditorValues,
} from "@/components/admin/university-management-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUniversity } from "@/lib/admin/university-management";
import { requireAdminPermission } from "@/lib/auth/dal";
import {
  VERIFICATION_LABELS,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";

export const metadata: Metadata = {
  title: "Edit university",
  robots: { index: false, follow: false },
};

export default async function AdminUniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { admin } = await requireAdminPermission("UNIVERSITIES_READ");
  const { id } = await params;
  const detail = await getAdminUniversity(id);
  if (!detail) notFound();

  const canManage = admin.permissions.has("UNIVERSITIES_MANAGE");
  const editorValues: UniversityEditorValues = {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    shortName: detail.shortName ?? "",
    city: detail.city,
    countryCode: detail.countryCode,
    websiteUrl: detail.websiteUrl ?? "",
    continent: detail.continent ?? "",
    institutionType: detail.institutionType ?? "",
    logoUrl: detail.logoUrl ?? "",
    description: detail.description ?? "",
    rankingOrganization: detail.rankingOrganization ?? "",
    rankingEdition: detail.rankingEdition ?? "",
    rankingPosition:
      detail.rankingPosition === null ? "" : String(detail.rankingPosition),
    rankingDisplay: detail.rankingDisplay ?? "",
    rankingTied: detail.rankingTied,
    rankingIsRange: detail.rankingIsRange,
    qsNid: detail.qsNid === null ? "" : String(detail.qsNid),
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
          href="/admin/universities"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          University catalog
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">
            {detail.name}
          </h1>
          <Badge>{VERIFICATION_LABELS[detail.status]}</Badge>
          {detail.featured ? <Badge variant="brand">Featured</Badge> : null}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {detail.city}, {countryName(detail.countryCode)} · {detail.slug} ·{" "}
          {detail.programCount} program{detail.programCount === 1 ? "" : "s"}
        </p>
        <Link
          href={`/universities/${detail.slug}`}
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
              These records share a normalised name, city, and country.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.duplicates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/admin/universities/${candidate.id}`}
                className="block rounded-md border px-3 py-2 text-sm hover:underline"
              >
                {candidate.name} — {candidate.city},{" "}
                {countryName(candidate.countryCode)} ({candidate.slug})
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
              <UniversityStatusActions
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
                <UniversityFeatureControl
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
                <UniversitySourceVerificationForm
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
            <UniversityEditorForm values={editorValues} />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <span>
            You have read-only access to this catalog domain. A University
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
