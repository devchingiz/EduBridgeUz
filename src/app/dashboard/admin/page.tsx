import { redirect } from "next/navigation";

/**
 * The administration surface now lives at /admin. This route is retained so
 * existing bookmarks and links keep working; there is intentionally no UI here.
 */
export default function LegacyAdminPage() {
  redirect("/admin");
}
