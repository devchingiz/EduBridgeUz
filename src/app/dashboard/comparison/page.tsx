import type { Metadata } from "next";
import Link from "next/link";

import { removeFromComparisonAction } from "@/app/dashboard/comparison/actions";
import { FieldStatusBadge } from "@/components/catalog/verification";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  getComparison,
  MAX_COMPARISON_UNIVERSITIES,
} from "@/lib/catalog/comparison";
import { VERIFICATION_LABELS } from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";

export const metadata: Metadata = {
  title: "Compare Universities",
  robots: { index: false, follow: false },
};

function money(amountMinor: number, currency: string): string {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    amountMinor / 10 ** digits,
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-border border-b align-top last:border-b-0">
      <th
        scope="row"
        className="text-muted-foreground w-40 px-3 py-3 text-left text-[12px] font-medium"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

export default async function ComparisonPage() {
  const session = await requireWorkspace();
  const items = await getComparison(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compare universities
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A private side-by-side shortlist of up to{" "}
            {MAX_COMPARISON_UNIVERSITIES} universities. Every value keeps its
            verification status and source.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/universities">Find universities</Link>
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="surface-card px-6 py-12 text-center">
          <h2 className="font-semibold">Your comparison is empty</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Open a university profile and choose “Compare” to add it here.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground w-40 px-3 py-3 text-left text-[12px] font-medium">
                  Field
                </th>
                {items.map((item) => (
                  <th key={item.id} className="min-w-52 px-3 py-3 text-left">
                    <div className="flex items-start gap-2">
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.logoUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="size-8 shrink-0 rounded object-contain"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/universities/${item.slug}`}
                          className="hover:text-primary hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-muted-foreground mt-0.5 text-[11px] font-normal">
                          {item.city}, {countryName(item.countryCode)}
                        </p>
                      </div>
                    </div>
                    <form action={removeFromComparisonAction} className="mt-2">
                      <input
                        type="hidden"
                        name="universityId"
                        value={item.id}
                      />
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        pendingLabel="Removing…"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Cell label="QS 2027 rank">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.rankingDisplay ?? (
                      <span className="text-muted-foreground italic">
                        Unavailable
                      </span>
                    )}
                  </td>
                ))}
              </Cell>
              <Cell label="Location">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.city}, {countryName(item.countryCode)}
                    {item.continent ? ` · ${item.continent}` : ""}
                  </td>
                ))}
              </Cell>
              <Cell label="Institution type">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.institutionType ?? (
                      <span className="text-muted-foreground italic">
                        Unavailable
                      </span>
                    )}
                  </td>
                ))}
              </Cell>
              <Cell label="Programs">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.programCount}
                  </td>
                ))}
              </Cell>
              <Cell label="Lowest annual tuition">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.lowestAnnualTuition ? (
                      <>
                        {money(
                          item.lowestAnnualTuition.amountMinor,
                          item.lowestAnnualTuition.currency,
                        )}
                        {item.lowestAnnualTuition.sourceUrl ? (
                          <a
                            href={item.lowestAnnualTuition.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary ml-2 text-[11px] underline underline-offset-2"
                          >
                            Source
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Unavailable
                      </span>
                    )}
                  </td>
                ))}
              </Cell>
              <Cell label="Languages">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    {item.languages.length > 0
                      ? item.languages.join(", ")
                      : "Unavailable"}
                  </td>
                ))}
              </Cell>
              <Cell label="Record status">
                {items.map((item) => (
                  <td key={item.id} className="px-3 py-3">
                    <Badge
                      variant={
                        item.status === "VERIFIED"
                          ? "success"
                          : item.status === "PARTIALLY_VERIFIED"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {VERIFICATION_LABELS[
                        item.status as keyof typeof VERIFICATION_LABELS
                      ] ?? item.status}
                    </Badge>
                  </td>
                ))}
              </Cell>
              {["institution_type", "official_website", "qs_ranking_2027"].map(
                (key) => (
                  <Cell
                    key={key}
                    label={
                      items
                        .flatMap((item) => item.facts)
                        .find((fact) => fact.fieldKey === key)?.label ?? key
                    }
                  >
                    {items.map((item) => {
                      const fact = item.facts.find((f) => f.fieldKey === key);
                      return (
                        <td key={item.id} className="px-3 py-3">
                          {fact ? (
                            <div className="space-y-1">
                              <p>
                                {fact.value ?? (
                                  <span className="text-muted-foreground italic">
                                    Information unavailable
                                  </span>
                                )}
                              </p>
                              <FieldStatusBadge status={fact.status} />
                              {fact.sourceUrl ? (
                                <a
                                  href={fact.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-primary block text-[11px] underline underline-offset-2"
                                >
                                  {fact.sourceTitle ?? "Source"}
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">
                              Information unavailable
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </Cell>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
