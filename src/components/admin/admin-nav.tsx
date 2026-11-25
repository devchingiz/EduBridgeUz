"use client";

import {
  Award,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/admin/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  superAdminOnly?: boolean;
};

const items: readonly NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    superAdminOnly: false,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    permission: "USERS_READ",
  },
  {
    href: "/admin/access",
    label: "Access control",
    icon: ShieldCheck,
    superAdminOnly: true,
  },
  {
    href: "/admin/content",
    label: "Homepage content",
    icon: FileText,
    permission: "CONTENT_READ",
  },
  {
    href: "/admin/universities",
    label: "Universities",
    icon: GraduationCap,
    permission: "UNIVERSITIES_READ",
  },
  {
    href: "/admin/scholarships",
    label: "Scholarships",
    icon: Award,
    permission: "SCHOLARSHIPS_READ",
  },
];

export function AdminNav({
  permissions,
  isSuperAdmin,
  orientation = "vertical",
}: {
  permissions: readonly Permission[];
  isSuperAdmin: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !permissions.includes(item.permission)) return false;
    return true;
  });

  return (
    <nav
      aria-label="Administration"
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1"
          : "flex flex-col gap-0.5",
      )}
    >
      {visible.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
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
