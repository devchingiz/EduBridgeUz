import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/brand/logo", () => ({ Logo: () => null }));
vi.mock("@/components/dashboard/dashboard-nav", () => ({
  DashboardNav: () => null,
}));
vi.mock("@/components/dashboard/logout-button", () => ({
  LogoutButton: () => null,
}));
vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/auth/resend-verification-form", async () => {
  const ReactModule = await import("react");
  return {
    ResendVerificationForm: ({
      label,
      className,
    }: {
      label: string;
      className?: string;
    }) =>
      ReactModule.createElement(
        "form",
        { className, "data-resend-form": "true" },
        ReactModule.createElement("button", null, label),
      ),
  };
});

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { WorkspaceStatus } from "@/lib/auth/dal";

type ShellProps = Omit<React.ComponentProps<typeof DashboardShell>, "children">;
const Shell = DashboardShell as React.ComponentType<ShellProps>;
import type { SessionUser } from "@/lib/auth/session";

const status = {
  isMinor: false,
  guardianConsentRequired: false,
  guardianConsentGranted: false,
  canUseWorkspace: true,
  profile: null,
  profileComplete: false,
} as WorkspaceStatus;

function renderDashboard(
  emailVerifiedAt: Date | null,
  children: React.ReactNode = React.createElement(
    "p",
    null,
    "Dashboard content",
  ),
): string {
  const user = {
    id: "user-1",
    email: "amina@example.com",
    name: "Amina Karimova",
    role: "STUDENT",
    emailVerifiedAt,
    dateOfBirth: new Date("2000-05-10T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as SessionUser;

  return renderToStaticMarkup(
    React.createElement(Shell, { user, status }, children),
  );
}

describe("dashboard verification banner", () => {
  it("shows the banner with a resend form for an unverified user", () => {
    const html = renderDashboard(null);

    expect(html).toContain("Email verification pending");
    expect(html).toContain("Open the verification link");
    expect(html).toContain('data-resend-form="true"');
    expect(html).toContain("Resend verification email");
    expect(html).toContain("Dashboard content");
  });

  it("does not show the banner for a verified user", () => {
    const html = renderDashboard(new Date());

    expect(html).not.toContain("Email verification pending");
    expect(html).not.toContain('data-resend-form="true"');
    expect(html).toContain("Dashboard content");
  });

  it("uses responsive layout classes", () => {
    const html = renderDashboard(
      null,
      React.createElement("p", null, "Another dashboard route"),
    );

    expect(html).toContain("sm:flex-row");
    expect(html).toContain("sm:w-56");
    expect(html).toContain("Another dashboard route");
  });
});
