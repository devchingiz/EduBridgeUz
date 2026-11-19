import type { MetadataRoute } from "next";

import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { db } from "@/lib/db";
import { siteConfig } from "@/lib/site";
import { logError } from "@/lib/observability/logger";

/**
 * Generated per request rather than at build time so a production build does
 * not need a live database. Only records that are publicly visible are listed;
 * unverified and archived records stay out of search engines.
 */
export const dynamic = "force-dynamic";

const staticRoutes: {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/universities", changeFrequency: "weekly", priority: 0.9 },
  { path: "/scholarships", changeFrequency: "weekly", priority: 0.9 },
  { path: "/data-sources", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [universities, programs, scholarships] = await Promise.all([
      db.university.findMany({
        where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
        select: { slug: true, updatedAt: true },
      }),
      db.program.findMany({
        where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
        select: {
          slug: true,
          updatedAt: true,
          university: { select: { slug: true } },
        },
      }),
      db.scholarship.findMany({
        where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    entries.push(
      ...universities.map((row) => ({
        url: `${siteConfig.url}/universities/${row.slug}`,
        lastModified: row.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
      ...programs.map((row) => ({
        url: `${siteConfig.url}/universities/${row.university.slug}/programs/${row.slug}`,
        lastModified: row.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...scholarships.map((row) => ({
        url: `${siteConfig.url}/scholarships/${row.slug}`,
        lastModified: row.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    );
  } catch (error) {
    // A sitemap failure must not take the site down; the static routes are
    // still useful and the catalog will be picked up on the next request.
    logError("sitemap.catalog_load_failed", error);
  }

  return entries;
}
