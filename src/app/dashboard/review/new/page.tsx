import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  importProgramAction,
  importScholarshipAction,
  importUniversityAction,
} from "@/app/dashboard/review/actions";
import { ImportForm } from "@/components/review/import-form";
import { requireRole } from "@/lib/auth/dal";
import { CATALOG_ENTITY_LABELS } from "@/lib/catalog/constants";
import { listUniversityOptions } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Import a catalog record",
  robots: { index: false, follow: false },
};

const TYPES = ["UNIVERSITY", "PROGRAM", "SCHOLARSHIP"] as const;
type EntityType = (typeof TYPES)[number];

const ACTIONS = {
  UNIVERSITY: importUniversityAction,
  PROGRAM: importProgramAction,
  SCHOLARSHIP: importScholarshipAction,
} as const;

export default async function ImportRecordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["REVIEWER", "ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;
  const requested = Array.isArray(params.type) ? params.type[0] : params.type;
  const entityType: EntityType = (TYPES as readonly string[]).includes(
    requested ?? "",
  )
    ? (requested as EntityType)
    : "UNIVERSITY";

  const universities =
    entityType === "PROGRAM" ? await listUniversityOptions() : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/review"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Review queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
          Import a catalog record
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          Records enter as verified only when you supply an official source and
          the date you checked it. Otherwise they wait in the review queue.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Record type"
        className="border-border flex gap-1 border-b"
      >
        {TYPES.map((type) => {
          const active = type === entityType;
          return (
            <Link
              key={type}
              href={`/dashboard/review/new?type=${type}`}
              role="tab"
              aria-selected={active}
              className={
                active
                  ? "border-primary text-foreground -mb-px border-b-2 px-3 py-2 text-[13px] font-medium"
                  : "text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium"
              }
            >
              {CATALOG_ENTITY_LABELS[type]}
            </Link>
          );
        })}
      </div>

      <ImportForm
        entityType={entityType}
        action={ACTIONS[entityType]}
        universities={universities}
        today={today}
      />
    </div>
  );
}
