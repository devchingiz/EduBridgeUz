import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getPrivacyContactEmail, getSecurityContactEmail } from "@/lib/env";

// Contacts are deployment configuration, so the page must reflect runtime
// values rather than a value baked into the build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security and disclosure",
  description:
    "How to report a security vulnerability to EduBridge and how to contact us about privacy requests.",
};

function Contact({
  email,
  purpose,
  variable,
}: {
  email: string | null;
  purpose: string;
  variable: string;
}) {
  if (!email) {
    return (
      <p className="text-muted-foreground text-[13px] leading-7">
        No {purpose} contact is configured in this environment. Production
        deployments must set <code className="font-mono">{variable}</code> to a
        deliverable address before launch.
      </p>
    );
  }

  return (
    <p className="text-[13px] leading-7">
      <a
        href={`mailto:${email}`}
        className="text-emerald-700 underline underline-offset-4 dark:text-emerald-300"
      >
        {email}
      </a>
    </p>
  );
}

export default function SecurityPage() {
  const securityEmail = getSecurityContactEmail();
  const privacyEmail = getPrivacyContactEmail();

  return (
    <div className="section-shell">
      <div className="site-container">
        <div className="mx-auto max-w-3xl">
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Responsible disclosure
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
            Security and disclosure
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[15px] leading-7">
            If you believe you have found a security weakness in EduBridge,
            please tell us privately so we can investigate and fix it. This page
            also explains how to reach us about personal data requests.
          </p>

          <div className="border-border mt-8 space-y-8 border-t pt-8">
            <section>
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                1. Reporting a vulnerability
              </h2>
              <div className="text-muted-foreground mt-2.5 space-y-3 text-[13.5px] leading-7">
                <p>
                  Email the security contact below with the affected page or
                  API, the steps needed to reproduce the issue, the impact you
                  observed, and a safe way to reach you. Please do not open a
                  public issue for an unfixed vulnerability.
                </p>
                <p>
                  Do not include real student records, passwords, session
                  tokens, or private document contents in a report. Use a test
                  account you own and redact any example data. We cannot accept
                  a report that requires accessing another person&apos;s data.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                2. Scope and acceptable testing
              </h2>
              <div className="text-muted-foreground mt-2.5 space-y-3 text-[13.5px] leading-7">
                <p>
                  Reports about the EduBridge application, its authentication,
                  and its APIs are in scope. Third-party services, provider
                  outages, and issues in software we do not operate should be
                  reported to their owners.
                </p>
                <p>
                  Please do not run denial-of-service or load tests, social
                  engineer staff or students, modify data that is not yours, or
                  attempt to access production infrastructure outside the
                  application. If a test exposes personal data, stop and report
                  what you saw without copying the data.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                3. How we handle reports
              </h2>
              <div className="text-muted-foreground mt-2.5 space-y-3 text-[13.5px] leading-7">
                <p>
                  We will acknowledge reports sent to the published security
                  address, confirm whether the issue is valid, prioritise a fix
                  by impact, and coordinate disclosure timing with the reporter.
                  We may ask for clarification or additional safe test steps.
                </p>
                <p>
                  Response targets, safe-harbour terms, and any recognition
                  programme must be approved by the operator before launch; this
                  page does not promise a specific timeline or reward.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                4. Privacy and data-rights requests
              </h2>
              <div className="text-muted-foreground mt-2.5 space-y-3 text-[13.5px] leading-7">
                <p>
                  For access, correction, export, or deletion of your account
                  data, or to withdraw guardian consent, use the privacy contact
                  below. Students and guardians may use the same address.
                </p>
                <p>
                  Tell us which email address or account is involved and what
                  you are requesting. We may need to verify your identity before
                  acting so that we do not disclose or delete another
                  person&apos;s data.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                5. Contacts
              </h2>
              <div className="mt-2.5 space-y-4">
                <div>
                  <p className="text-[13px] font-medium">Security reports</p>
                  <Contact
                    email={securityEmail}
                    purpose="security"
                    variable="SECURITY_CONTACT_EMAIL"
                  />
                </div>
                <div>
                  <p className="text-[13px] font-medium">
                    Privacy and data-rights requests
                  </p>
                  <Contact
                    email={privacyEmail}
                    purpose="privacy"
                    variable="PRIVACY_CONTACT_EMAIL"
                  />
                </div>
                <p className="text-muted-foreground text-[12.5px] leading-6">
                  See the{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-2"
                  >
                    privacy notice
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="underline underline-offset-2">
                    terms of use
                  </Link>
                  .
                </p>
              </div>
            </section>
          </div>

          <div className="border-border bg-muted/30 text-muted-foreground mt-10 rounded-xl border p-4 text-[11.5px] leading-5">
            The operator must review this policy and verify that the published
            mailboxes are monitored before launch. Placeholder and reserved
            domains are rejected by production readiness and are never shown
            here.
          </div>
        </div>
      </div>
    </div>
  );
}
