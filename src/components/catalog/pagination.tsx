import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  hrefForPage,
  totalLabel,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  totalLabel: string;
}) {
  if (pageCount <= 1) {
    return <p className="text-muted-foreground text-[12.5px]">{totalLabel}</p>;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-muted-foreground text-[12.5px]">
        {totalLabel} · Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefForPage(page - 1)} rel="prev">
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
        )}
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefForPage(page + 1)} rel="next">
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}

export function EmptyResults({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="text-muted-foreground mt-2 max-w-sm text-[12.5px] leading-6">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
