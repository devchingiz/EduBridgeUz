import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, ArrowUpRight } from "lucide-react";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import { VerificationBadge } from "@/components/catalog/verification";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/dal";
import { listCatalogFavorites } from "@/lib/catalog/favorites";
import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";

export const metadata: Metadata = {
  title: "Your favorites",
  robots: { index: false, follow: false },
};

function dashboardHref(
  entityType: "UNIVERSITY" | "SCHOLARSHIP",
  slug: string,
): string {
  return `/dashboard/${entityType === "UNIVERSITY" ? "universities" : "scholarships"}/${slug}`;
}

export default async function FavoritesPage() {
  const session = await requireWorkspace();
  const favorites = await listCatalogFavorites(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Student workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Your favorites
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Keep promising universities and scholarships together while you
          explore. Always check the linked official source before applying.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
          <Bookmark
            aria-hidden="true"
            className="text-muted-foreground size-6"
          />
          <h2 className="mt-3 text-base font-semibold">Nothing saved yet</h2>
          <p className="text-muted-foreground mt-1 max-w-md text-sm leading-6">
            Save a university or scholarship from its catalog card or detail
            page and it will appear here.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/universities">Explore universities</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/scholarships">Find scholarships</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {favorites.map((favorite) => {
            const available = (
              PUBLIC_VISIBLE_STATUSES as readonly string[]
            ).includes(favorite.status);
            return (
              <article
                key={`${favorite.entityType}-${favorite.id}`}
                className="surface-card flex items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    {favorite.entityType === "UNIVERSITY"
                      ? "University"
                      : "Scholarship"}
                  </p>
                  <h2 className="mt-1 text-[15px] font-semibold">
                    {available ? (
                      <Link
                        href={dashboardHref(favorite.entityType, favorite.slug)}
                        className="hover:underline hover:underline-offset-2"
                      >
                        {favorite.name}
                      </Link>
                    ) : (
                      favorite.name
                    )}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-[12.5px]">
                    {favorite.context}
                  </p>
                  <div className="mt-2">
                    <VerificationBadge status={favorite.status} />
                  </div>
                  {available ? (
                    <Link
                      href={dashboardHref(favorite.entityType, favorite.slug)}
                      className="text-primary mt-3 inline-flex items-center gap-1 text-[12px] font-medium"
                    >
                      View details
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-[11.5px]">
                      This record is no longer available in the public catalog.
                    </p>
                  )}
                </div>
                <FavoriteButton
                  entityType={favorite.entityType}
                  id={favorite.id}
                  saved
                  signedIn
                  returnTo="/dashboard/favorites"
                  compact
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
