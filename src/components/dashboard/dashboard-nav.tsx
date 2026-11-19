"use client";

import {
  ClipboardCheck,
  CalendarDays,
  Columns3,
  FileText,
  NotebookPen,
  Heart,
  LayoutDashboard,
  Search,
  Sparkles,
  Bell,
  GraduationCap,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const baseItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/settings", label: "Account", icon: Settings },
] as const;

export function DashboardNav({
  staff,
  admin = false,
  minor,
  orientation = "vertical",
}: {
  staff: boolean;
  admin?: boolean;
  minor: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  const items = [
    ...baseItems.slice(0, 2),
    {
      href: "/dashboard/applications",
      label: "Applications",
      icon: GraduationCap,
      exact: false,
    },
    {
      href: "/dashboard/universities",
      label: "Explore Universities",
      icon: Search,
      exact: false,
    },
    {
      href: "/dashboard/documents",
      label: "Documents",
      icon: FileText,
      exact: false,
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarDays,
      exact: false,
    },
    {
      href: "/dashboard/notifications",
      label: "Notifications",
      icon: Bell,
      exact: false,
    },
    {
      href: "/dashboard/favorites",
      label: "Favorites",
      icon: Heart,
      exact: false,
    },
    {
      href: "/dashboard/comparison",
      label: "Compare",
      icon: Columns3,
      exact: false,
    },
    {
      href: "/dashboard/notes",
      label: "Study Notes",
      icon: NotebookPen,
      exact: false,
    },
    {
      href: "/dashboard/advisor",
      label: "AI Advisor",
      icon: Sparkles,
      exact: false,
    },
    ...(minor
      ? [
          {
            href: "/dashboard/guardian-consent",
            label: "Guardian consent",
            icon: ShieldCheck,
            exact: false,
          },
        ]
      : []),
    ...baseItems.slice(2),
    ...(staff
      ? [
          {
            href: "/dashboard/review",
            label: "Review",
            icon: ClipboardCheck,
            exact: false,
          },
          {
            href: "/dashboard/admin",
            label: "Admin",
            icon: ShieldEllipsis,
            exact: false,
          },
          ...(admin
            ? [
                {
                  href: "/dashboard/admin/users",
                  label: "Users",
                  icon: Users,
                  exact: false,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Dashboard"
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1"
          : "flex flex-col gap-0.5",
      )}
    >
      {items.map((item) => {
        const active =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors",
              orientation === "horizontal" ? "h-9 px-3" : "h-10 px-3",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
