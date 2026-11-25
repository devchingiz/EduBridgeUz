import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { HomepageEditorForm } from "@/components/admin/homepage-editor-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/auth/dal";
import { getAdminHomepage } from "@/lib/cms/homepage";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Homepage content",
  robots: { index: false, follow: false },
};

export default async function AdminContentPage() {
  const { admin } = await requireAdminPermission("CONTENT_READ");
  const homepage = await getAdminHomepage();
  const canManage = admin.permissions.has("CONTENT_MANAGE");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Administration overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
          Homepage content
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          Edit the controlled homepage document. Values are rendered as plain
          text and links are limited to internal destinations; markup, scripts,
          and custom styles are rejected by the server.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publication state</CardTitle>
          <CardDescription>
            Saves update the public homepage immediately and invalidate its
            cache.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={homepage.usingDefaults ? "warning" : "success"}>
            {homepage.usingDefaults ? "Default copy" : "Published from CMS"}
          </Badge>
          <span className="text-muted-foreground">
            Revision {homepage.revision}
          </span>
          <span className="text-muted-foreground">
            {homepage.updatedAt
              ? `Last saved ${formatDateTime(homepage.updatedAt)}${homepage.updatedByName ? ` by ${homepage.updatedByName}` : ""}`
              : "No administrator save recorded"}
          </span>
          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="text-primary ml-auto inline-flex items-center gap-1.5 text-[12.5px] hover:underline"
          >
            View public homepage
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit homepage</CardTitle>
            <CardDescription>
              Every field is validated before the revision is written and the
              homepage cache is cleared.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HomepageEditorForm values={homepage.content} />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <span>
            You have read-only access to content. A Content Manager or Super
            Admin can change this document.
          </span>
        </Alert>
      )}
    </div>
  );
}
