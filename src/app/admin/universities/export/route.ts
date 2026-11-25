import { requireAdminPermission } from "@/lib/auth/dal";
import { exportUniversitiesCsv } from "@/lib/admin/university-management";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPermission("UNIVERSITIES_READ");
  const csv = await exportUniversitiesCsv();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="universities-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
