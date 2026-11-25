import { exportScholarshipsCsv } from "@/lib/admin/scholarship-management";
import { requireAdminPermission } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPermission("SCHOLARSHIPS_READ");
  const csv = await exportScholarshipsCsv();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scholarships-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
