"use client";

import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  GraduationCap,
  Languages,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { VerificationBadge } from "@/components/catalog/verification";
import type { VerificationStatusValue } from "@/lib/catalog/constants";
import { availableText } from "@/lib/catalog/fact-groups";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { degreeLabel } from "@/lib/data/fields";

export type ProgramCardData = {
  id: string;
  slug: string;
  name: string;
  degreeLevel: string;
  field: string;
  language: string | null;
  durationMonths: number | null;
  credits: number | null;
  status: VerificationStatusValue;
  requirementCount: number;
  tuitionCount: number;
  deadlineCount: number;
};

export function ProgramExplorer({
  programs,
  universitySlug,
}: {
  programs: ProgramCardData[];
  universitySlug: string;
}) {
  const [query, setQuery] = useState("");
  const [degree, setDegree] = useState("ALL");
  const deferredQuery = useDeferredValue(query);

  const degrees = useMemo(
    () => [...new Set(programs.map((program) => program.degreeLevel))].sort(),
    [programs],
  );

  const visiblePrograms = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesDegree = degree === "ALL" || program.degreeLevel === degree;
      const field = availableText(program.field) ?? "";
      const matchesQuery =
        needle.length === 0 ||
        program.name.toLowerCase().includes(needle) ||
        field.toLowerCase().includes(needle);
      return matchesDegree && matchesQuery;
    });
  }, [programs, deferredQuery, degree]);

  return (
    <div>
      <div className="surface-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Search programs</span>
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by program or field"
              className="pl-9"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[12px]">
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              Level
            </span>
            <button
              type="button"
              onClick={() => setDegree("ALL")}
              className={
                degree === "ALL"
                  ? "bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-[12px] font-medium"
                  : "bg-muted text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-[12px] transition-colors"
              }
            >
              All
            </button>
            {degrees.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDegree(value)}
                className={
                  degree === value
                    ? "bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-[12px] font-medium"
                    : "bg-muted text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-[12px] transition-colors"
                }
              >
                {degreeLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-[12px]">
          Showing {visiblePrograms.length} of {programs.length} published
          programs
        </p>
      </div>

      {visiblePrograms.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePrograms.map((program) => {
            const href = `/universities/${universitySlug}/programs/${program.slug}`;
            const field = availableText(program.field);
            const language = availableText(program.language);
            const degree = availableText(degreeLabel(program.degreeLevel));
            return (
              <article
                key={program.id}
                className="surface-card hover:border-primary/30 flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
                    <BookOpen aria-hidden="true" className="size-4" />
                  </div>
                  <VerificationBadge status={program.status} />
                </div>

                <h3 className="mt-4 text-[15px] leading-5 font-semibold tracking-[-0.01em]">
                  <Link
                    href={href}
                    className="focus-visible:ring-ring/40 rounded-sm outline-none focus-visible:ring-2"
                  >
                    {program.name}
                  </Link>
                </h3>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {degree ? <Badge variant="brand">{degree}</Badge> : null}
                  {field ? <Badge variant="muted">{field}</Badge> : null}
                </div>

                <div className="text-muted-foreground mt-4 grid gap-2 text-[12px]">
                  {degree ? (
                    <p className="inline-flex items-center gap-2">
                      <GraduationCap aria-hidden="true" className="size-3.5" />
                      {degree}
                      {program.credits ? ` · ${program.credits} credits` : ""}
                    </p>
                  ) : null}
                  {program.durationMonths ? (
                    <p className="inline-flex items-center gap-2">
                      <Clock3 aria-hidden="true" className="size-3.5" />
                      {program.durationMonths} months
                    </p>
                  ) : null}
                  {language ? (
                    <p className="inline-flex items-center gap-2">
                      <Languages aria-hidden="true" className="size-3.5" />
                      {language}
                    </p>
                  ) : null}
                </div>

                <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-[11px]">
                  <span>{program.requirementCount} requirements</span>
                  <span>{program.tuitionCount} tuition facts</span>
                  <span>{program.deadlineCount} deadlines</span>
                </div>

                <Link
                  href={href}
                  className="text-primary mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline hover:underline-offset-2"
                >
                  Open program
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface-card mt-4 px-6 py-12 text-center">
          <Search
            aria-hidden="true"
            className="text-muted-foreground mx-auto size-5"
          />
          <p className="mt-3 text-[14px] font-medium">
            No programs match that search
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-[12.5px] leading-6">
            Try a different keyword or choose another degree level. Every
            published program remains available from the full list.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDegree("ALL");
            }}
            className="text-primary mt-4 text-[12.5px] font-medium hover:underline hover:underline-offset-2"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
