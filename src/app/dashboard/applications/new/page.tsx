import type { Metadata } from "next";
import Link from "next/link";

import { createApplicationAction } from "@/app/dashboard/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";
import { listWorkspaceUniversities } from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Add an application",
  robots: { index: false, follow: false },
};

export default async function NewApplicationPage() {
  await requireWorkspace();
  const universities = await listWorkspaceUniversities();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Application tracker
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Add a university</h1>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Choose a currently listed university. You can update the status,
          deadline, and notes later. Deadlines you enter are private tracker
          entries, not catalog facts.
        </p>
      </header>
      {universities.length ? (
        <form
          action={createApplicationAction}
          className="surface-card space-y-5 p-5 sm:p-6"
        >
          <label className="block space-y-1.5 text-sm font-medium">
            University
            <Select name="universityId" required defaultValue="">
              <option value="" disabled>
                Select a university
              </option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name} — {university.city},{" "}
                  {university.countryCode}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Status
            <Select name="status" defaultValue="INTERESTED">
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Application deadline{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
            <Input type="date" name="deadline" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Notes{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
            <Textarea
              name="notes"
              maxLength={5000}
              placeholder="What should you remember about this application?"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Add to tracker</Button>
            <Button asChild type="button" variant="outline">
              <Link href="/dashboard/applications">Cancel</Link>
            </Button>
          </div>
        </form>
      ) : (
        <div className="surface-card p-6">
          <p className="text-sm">
            There are no currently listed universities to add.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/universities">Browse universities</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
