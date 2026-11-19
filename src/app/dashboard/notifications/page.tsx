import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Check } from "lucide-react";

import {
  markNotificationReadAction,
  saveNotificationPreferencesAction,
} from "@/app/dashboard/workspace-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { requireWorkspace } from "@/lib/auth/dal";
import { NOTIFICATION_LABELS } from "@/lib/workspace/constants";
import {
  getNotificationPreferences,
  listWorkspaceNotifications,
} from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

const preferenceFields = [
  ["deadlines", "DEADLINE"],
  ["applicationStatus", "APPLICATION_STATUS"],
  ["missingDocuments", "MISSING_DOCUMENT"],
  ["scholarshipAnnouncements", "SCHOLARSHIP_ANNOUNCEMENT"],
] as const;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireWorkspace();
  const [preferences, notifications, query] = await Promise.all([
    getNotificationPreferences(session.user.id),
    listWorkspaceNotifications(session.user.id),
    searchParams,
  ]);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Student workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Notifications
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          In-app reminders are based on your applications, documents, and recent
          catalog updates.
        </p>
      </header>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Notification preferences</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose the updates you want to see in this workspace.
        </p>
        {query.saved ? (
          <p
            role="status"
            className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            Preferences saved.
          </p>
        ) : null}
        <form
          action={saveNotificationPreferencesAction}
          className="mt-4 space-y-3"
        >
          {preferenceFields.map(([field, type]) => (
            <label
              key={field}
              className="border-border flex items-start gap-3 rounded-lg border p-3"
            >
              <Checkbox
                name={field}
                defaultChecked={preferences[field]}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  {NOTIFICATION_LABELS[type]}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {type === "DEADLINE"
                    ? "Deadlines within 30 days."
                    : type === "APPLICATION_STATUS"
                      ? "Status changes in your application tracker."
                      : type === "MISSING_DOCUMENT"
                        ? "A reminder when documents remain marked in progress."
                        : "Recently added source-verified scholarship records."}
                </span>
              </span>
            </label>
          ))}
          <Button type="submit" size="sm">
            Save preferences
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell aria-hidden="true" className="size-4" />
          <h2 className="text-base font-semibold">Your updates</h2>
        </div>
        {notifications.length ? (
          notifications.map((notification) => (
            <article
              key={notification.id}
              className={`surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${notification.readAt ? "opacity-70" : ""}`}
            >
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                  {NOTIFICATION_LABELS[notification.type]}
                </p>
                <h3 className="mt-1 text-sm font-semibold">
                  {notification.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {notification.body}
                </p>
                <time
                  className="text-muted-foreground mt-2 block text-[11px]"
                  dateTime={notification.createdAt.toISOString()}
                >
                  {notification.createdAt.toLocaleString()}
                </time>
                {notification.href ? (
                  <Link
                    className="text-primary mt-2 inline-block text-xs font-medium underline underline-offset-2"
                    href={notification.href}
                  >
                    Open related item
                  </Link>
                ) : null}
              </div>
              {!notification.readAt &&
              !notification.id.startsWith("deadline-") &&
              !notification.id.startsWith("missing-") &&
              !notification.id.startsWith("scholarship-") ? (
                <form action={markNotificationReadAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <Button size="sm" variant="outline">
                    <Check /> Mark read
                  </Button>
                </form>
              ) : null}
            </article>
          ))
        ) : (
          <div className="surface-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              You are all caught up. New updates will appear here when relevant.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
