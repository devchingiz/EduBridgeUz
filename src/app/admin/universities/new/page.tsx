import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  blankUniversityEditorValues,
  UniversityEditorForm,
} from "@/components/admin/university-management-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "New university",
  robots: { index: false, follow: false },
};

export default async function NewAdminUniversityPage() {
  await requireAdminPermission("UNIVERSITIES_MANAGE");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/universities"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          University catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
          Add a university
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Store only sourced facts. Publishing is blocked until the primary
          source has a verification date.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>University profile</CardTitle>
          <CardDescription>
            All fields are validated on the server before a catalog row is
            written.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UniversityEditorForm values={blankUniversityEditorValues} />
        </CardContent>
      </Card>
    </div>
  );
}
