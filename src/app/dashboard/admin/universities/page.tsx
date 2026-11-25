import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/** Legacy route retained as a redirect to the separate /admin surface. */
export default async function LegacyAdminUniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const suffix = query.toString();
  redirect(`/admin/universities${suffix ? `?${suffix}` : ""}`);
}
