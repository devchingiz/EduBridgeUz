import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { isAdminPanelRole, isStaff, ROLE_LABELS } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { WorkspaceStatus } from "@/lib/auth/dal";

export function DashboardShell({
  user,
  status,
  children,
}: {
  user: SessionUser;
  status: WorkspaceStatus;
  children: React.ReactNode;
}) {
  const staff = isStaff(user.role);
  const canAccessAdmin = isAdminPanelRole(user.role);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="border-border bg-muted/20 hidden flex-col border-r lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>

        <div className="px-3 py-2">
          <DashboardNav
            staff={staff}
            admin={canAccessAdmin}
            minor={status.isMinor}
          />
        </div>

        <div className="border-border mt-auto border-t p-4">
          <div className="min-w-0 px-1">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-[11.5px]">
              {user.email}
            </p>
            <Badge variant="muted" className="mt-2">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <Logo className="lg:hidden" showWordmark={false} />
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <LogoutButton showLabel={false} />
          </div>
        </header>

        <div className="border-border scrollbar-none overflow-x-auto border-b px-3 py-2 lg:hidden">
          <DashboardNav
            staff={staff}
            admin={canAccessAdmin}
            minor={status.isMinor}
            orientation="horizontal"
          />
        </div>

        {user.emailVerifiedAt ? null : <EmailVerificationBanner />}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
