import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { ResendVerificationForm } from "@/components/admin/resend-verification-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Administration access unavailable",
  robots: { index: false, follow: false },
};

export default async function AdminAccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const reason = Array.isArray(params.reason)
    ? params.reason[0]
    : params.reason;
  const user = await getCurrentUser();

  const unverified = reason === "unverified" && Boolean(user);
  const nonAdmin = reason === "account" && Boolean(user);
  const title = unverified
    ? "Verify your email first"
    : nonAdmin
      ? "Administrator access only"
      : "Administration access unavailable";
  const description = unverified
    ? "Administrator accounts must have a verified email address. Request a new verification link, open it, then sign in again."
    : nonAdmin
      ? "This account is not an administrator account. If you believe this is a mistake, contact an administrator."
      : "Your account does not have the required administrator role or capability. Access is enforced from the database on every request.";

  return (
    <main className="site-container flex min-h-dvh items-center justify-center py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Badge variant="warning" className="w-fit">
            <ShieldAlert aria-hidden="true" />
            Access check
          </Badge>
          <CardTitle className="mt-3 text-xl">{title}</CardTitle>
          <CardDescription className="leading-6">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <p className="text-muted-foreground text-[12.5px]">
              Signed in as {user.email}
            </p>
          ) : null}

          {unverified ? <ResendVerificationForm /> : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Back to site</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
