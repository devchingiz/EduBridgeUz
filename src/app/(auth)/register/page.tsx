import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleAuthMessage } from "@/components/auth/google-auth-message";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free EduBridge account to plan international university applications and scholarship searches.",
  robots: { index: true, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Just a few details. You can add study preferences later."
    >
      <div className="space-y-4">
        <GoogleAuthMessage code={params.google} />
        <RegisterForm />
      </div>
    </AuthShell>
  );
}
