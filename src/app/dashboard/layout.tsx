import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser, getWorkspaceStatus } from "@/lib/auth/dal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layouts are not a security boundary: each page and action re-checks. This
  // one exists so every dashboard route shares the same shell and user DTO.
  const session = await requireUser();
  const status = await getWorkspaceStatus(session.user);

  return (
    <DashboardShell user={session.user} status={status}>
      {children}
    </DashboardShell>
  );
}
