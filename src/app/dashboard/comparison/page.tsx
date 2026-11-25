import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  ExternalLink,
  Info,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import {
  removeFromComparisonAction,
  setComparisonOrderAction,
} from "@/app/dashboard/comparison/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  FieldStatusBadge,
  VerificationBadge,
} from "@/components/catalog/verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  getComparison,
  MAX_COMPARISON_UNIVERSITIES,
} from "@/lib/catalog/comparison";
import {
  buildComparisonGroups,
  countDifferentRows,
  countSourcedFields,
  type ComparisonCell,
  type ComparisonGroup,
} from "@/lib/catalog/comparison-view";
import type { FieldVerificationStatusValue } from "@/lib/catalog/constants";
import { formatCheckedOn } from "@/lib/catalog/format";
import { countryName } from "@/lib/data/countries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Compare Universities",
  robots: { index: false, follow: false },
};

function CellContent({ cell }: { cell: ComparisonCell }) {
  if (!cell.available) {
    return (
      <div className="space-y-1.5">
        <span className="text-muted-foreground italic">
          Information unavailable
        </span>
        {cell.status ? (
          <div>
            <FieldStatusBadge
              status={cell.status as FieldVerificationStatusValue}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {cell.href ? (
        <a
          href={cell.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary inline-flex items-center gap-1 font-medium underline underline-offset-2"
        >
          {cell.value}
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      ) : (
        <p className="font-medium">{cell.value}</p>
      )}
      {cell.detail ? (
        <p className="text-muted-foreground text-[11px] leading-4">
          {cell.detail}
        </p>
      ) : null}
      {cell.derived || cell.status ? (
        <div className="flex flex-wrap gap-1.5">
          {cell.derived ? <Badge variant="brand">Catalog-derived</Badge> : null}
          {cell.status ? (
            <FieldStatusBadge
              status={cell.status as FieldVerificationStatusValue}
            />
          ) : null}
        </div>
      ) : null}
      {cell.verifiedAt ? (
        <p className="text-muted-foreground text-[10px]">
          {formatCheckedOn(cell.verifiedAt)}
        </p>
      ) : null}
      {cell.sourceUrl ? (
        <a
          href={cell.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary block text-[11px] underline underline-offset-2"
        >
          {cell.sourceTitle ?? "Source"}
        </a>
      ) : cell.status ? (
        <p className="text-muted-foreground text-[10px]">No source link</p>
      ) : null}
      {cell.note ? (
        <p className="text-muted-foreground text-[10px] leading-4">
          {cell.note}
        </p>
      ) : null}
    </div>
  );
}

function ComparisonTable({
  groups,
  itemCount,
}: {
  groups: ComparisonGroup[];
  itemCount: number;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-border bg-muted/30 border-b">
              <th
                scope="col"
                className="text-muted-foreground bg-muted/30 sticky left-0 z-20 w-48 border-r px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase"
              >
                Field
              </th>
              {Array.from({ length: itemCount }, (_, index) => (
                <th
                  key={index}
                  scope="col"
                  className="min-w-56 px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase"
                >
                  University {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id}>
              <tr className="border-border bg-muted/40 border-b">
                <th
                  colSpan={itemCount + 1}
                  scope="colgroup"
                  className="px-4 py-2 text-left"
                >
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="text-muted-foreground ml-2 text-[11px] font-normal">
                    {group.description}
                  </span>
                </th>
              </tr>
              {group.rows.map((comparisonRow) => (
                <tr
                  key={comparisonRow.id}
                  className={cn(
                    "border-border border-b align-top last:border-b-0",
                    comparisonRow.differs && "bg-primary/[0.025]",
                  )}
                >
                  <th
                    scope="row"
                    className="text-muted-foreground bg-card sticky left-0 z-10 w-48 border-r px-4 py-3 text-left align-top text-[12px] font-medium"
                  >
                    <span className="block">{comparisonRow.label}</span>
                    <Badge
                      variant={comparisonRow.differs ? "warning" : "muted"}
                      className="mt-1.5"
                    >
                      {comparisonRow.differs ? "Differs" : "Same"}
                    </Badge>
                  </th>
                  {comparisonRow.cells.map((cell, index) => (
                    <td
                      key={index}
                      className="min-w-56 border-r px-4 py-3 align-top text-[13px] last:border-r-0"
                    >
                      <CellContent cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl leading-none font-semibold tracking-[-0.03em]">
        {value}
      </p>
      <p className="text-muted-foreground mt-1.5 text-[11px]">{detail}</p>
    </div>
  );
}

export default async function ComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "differences" ? "differences" : "all";
  const session = await requireWorkspace();
  const items = await getComparison(session.user.id);
  const groups = buildComparisonGroups(items);
  const differenceCount = countDifferentRows(groups);
  const sourceCount = countSourcedFields(groups);
  const visibleGroups =
    view === "differences"
      ? groups
          .map((group) => ({
            ...group,
            rows: group.rows.filter((row) => row.differs),
          }))
          .filter((group) => group.rows.length > 0)
      : groups;
  const visibleRowCount = visibleGroups.reduce(
    (total, group) => total + group.rows.length,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="border-primary/15 from-accent/80 via-card to-card relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8">
        <div
          className="hero-grid pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
        />
        <div
          className="bg-primary/10 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Private workspace · Side-by-side review</p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
              Compare universities
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              A shortlist of up to {MAX_COMPARISON_UNIVERSITIES} universities.
              Values keep their verification status and source; amounts stay in
              their source currency with no conversion claims.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/universities">
              <Search aria-hidden="true" />
              Find universities
            </Link>
          </Button>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="surface-card px-6 py-14 text-center">
          <span className="bg-accent text-accent-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
            <Columns3 aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            Your comparison is empty
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Open a university profile and choose “Compare” to add it here. Your
            shortlist stays private to your account.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link href="/dashboard/universities">Explore the catalog</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Shortlist"
              value={`${items.length}/${MAX_COMPARISON_UNIVERSITIES}`}
              detail="Private to your workspace"
            />
            <Stat
              label="Rows shown"
              value={visibleRowCount}
              detail={
                view === "differences" ? "Differences only" : "All fields"
              }
            />
            <Stat
              label="Different values"
              value={differenceCount}
              detail="Across the current shortlist"
            />
            <Stat
              label="Source-linked cells"
              value={sourceCount}
              detail="With a citation link"
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Shortlist</h2>
                <p className="text-muted-foreground text-xs">
                  Use the arrows to change column order, or remove a university
                  to make room.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={view === "all" ? "default" : "outline"}
                >
                  <Link href="/dashboard/comparison">All fields</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant={view === "differences" ? "default" : "outline"}
                >
                  <Link href="/dashboard/comparison?view=differences">
                    Differences only
                  </Link>
                </Button>
                <form action={setComparisonOrderAction}>
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    pendingLabel="Clearing…"
                  >
                    <Trash2 aria-hidden="true" />
                    Clear all
                  </SubmitButton>
                </form>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {items.map((item, index) => {
                const order = items.map((entry) => entry.id);
                const move = (target: number) => {
                  if (target < 0 || target >= items.length) return order;
                  const next = [...order];
                  [next[index], next[target]] = [next[target], next[index]];
                  return next;
                };
                const leftOrder = move(index - 1);
                const rightOrder = move(index + 1);

                return (
                  <div key={item.id} className="surface-card flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.logoUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="size-9 shrink-0 rounded object-contain"
                        />
                      ) : (
                        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                          {index + 1}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/universities/${item.slug}`}
                          className="hover:text-primary block text-sm leading-5 font-semibold hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {item.city}, {countryName(item.countryCode)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge variant="brand">Column {index + 1}</Badge>
                      <VerificationBadge
                        status={
                          item.status as Parameters<
                            typeof VerificationBadge
                          >[0]["status"]
                        }
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                      {item.websiteUrl ? (
                        <a
                          href={item.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          Official site
                          <ExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          Website unavailable
                        </span>
                      )}
                    </div>

                    <div className="border-border mt-auto flex items-center justify-end gap-1 border-t pt-3">
                      <form action={setComparisonOrderAction}>
                        {leftOrder.map((id) => (
                          <input
                            key={id}
                            type="hidden"
                            name="universityId"
                            value={id}
                          />
                        ))}
                        <SubmitButton
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${item.name} left`}
                          title="Move left"
                          disabled={index === 0}
                          pendingLabel="Moving…"
                        >
                          <ArrowLeft aria-hidden="true" />
                        </SubmitButton>
                      </form>
                      <form action={setComparisonOrderAction}>
                        {rightOrder.map((id) => (
                          <input
                            key={id}
                            type="hidden"
                            name="universityId"
                            value={id}
                          />
                        ))}
                        <SubmitButton
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${item.name} right`}
                          title="Move right"
                          disabled={index === items.length - 1}
                          pendingLabel="Moving…"
                        >
                          <ArrowRight aria-hidden="true" />
                        </SubmitButton>
                      </form>
                      <form action={removeFromComparisonAction}>
                        <input
                          type="hidden"
                          name="universityId"
                          value={item.id}
                        />
                        <SubmitButton
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${item.name} from comparison`}
                          title="Remove"
                          pendingLabel="Removing…"
                        >
                          <Trash2 aria-hidden="true" />
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              <Info
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4"
              />
              <p className="text-muted-foreground text-xs leading-5">
                This is a source-backed review aid, not a ranking. “Same” and
                “Differs” compare displayed values only — not source quality.
                Missing catalog fields remain explicit and no currency
                conversion is performed.
              </p>
            </div>

            {visibleGroups.length === 0 ? (
              <div className="surface-card px-6 py-10 text-center">
                <h3 className="font-semibold">No values differ</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Every displayed field is the same across the current
                  shortlist. Switch to all fields to inspect the sources.
                </p>
              </div>
            ) : (
              <ComparisonTable
                groups={visibleGroups}
                itemCount={items.length}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
