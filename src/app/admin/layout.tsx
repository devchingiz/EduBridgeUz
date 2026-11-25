import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPermission } from "@/lib/auth/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layouts are a UX shell, not the security boundary. Pages and actions repeat
  // their specific capability checks; this gate keeps the whole surface staff-only.
  const { admin } = await requireAdminPermission();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
