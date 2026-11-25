import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How EduBridge collects, uses, protects, and deletes personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      description="This notice describes the data handled by the EduBridge application as it is implemented today. The deployed operator must complete legal review and publish final retention, transfer, and governing-law details before production launch."
      updated="24 November 2026"
    >
      <div className="rounded-xl border border-amber-600/20 bg-amber-50/60 p-4 text-[13px] leading-6 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-100">
        <strong className="font-semibold">Deployment status:</strong> account
        registration, private documents, application tracking, and an opt-in AI
        advisor are implemented in this build. Which features are enabled, which
        providers are used, and how long data is retained depend on the
        operator&apos;s configuration and contracts. Items described as
        &ldquo;provider-dependent&rdquo; below have not been verified in this
        environment.
      </div>

      <LegalSection title="1. Information we collect">
        <LegalList
          items={[
            "Account details: name, email address, a salted password hash, date of birth, role, email-verification status, and optional two-factor settings (an encrypted authenticator secret and hashed one-time recovery codes).",
            "Sign-in details: hashed session and token values, hashed IP addresses used for throttling, user agent, and security audit events. Raw passwords, session tokens, and reset links are never stored in plaintext.",
            "Google sign-in, when enabled: the stable Google account identifier only. Google access tokens are not stored.",
            "Student profile: country, education level, intended degree and field, preferred destinations, budget, and optional test scores or GPA. Minors also have a guardian name and email address.",
            "Workspace data: saved universities and scholarships, applications and their history, private documents, study notes, comparison shortlists, notification preferences, and consent records with policy versions.",
            "AI advisor conversations and a metadata-only usage ledger (provider, model, token counts, estimated cost, and outcome). The ledger does not duplicate prompts or answers.",
          ]}
        />
        <p>
          We do not ask for passport numbers, financial account details, or
          health information. Uploaded documents may contain such information if
          you choose to include it; do not upload data that is not needed for
          your application process.
        </p>
      </LegalSection>

      <LegalSection title="2. Why we use it">
        <LegalList
          items={[
            "To provide discovery, saving, comparison, application tracking, and document handling features.",
            "To verify accounts, enforce guardian consent for minors, and sign users in securely.",
            "To generate profile-aware guidance when the advisor is enabled.",
            "To send deadline and document reminders you opt into.",
            "To prevent abuse, detect breached passwords, investigate incidents, and meet legal obligations.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Passwords and third-party checks">
        <p>
          Passwords are checked against the Have I Been Pwned k-anonymity range
          service at registration, password reset, and password change. Only the
          first five characters of a SHA-1 hash prefix are sent; your password
          is never sent to that service. Production is configured to fail closed
          if the check cannot be completed.
        </p>
      </LegalSection>

      <LegalSection title="4. Minors and guardian consent">
        <p>
          Students under 18 provide a guardian name and a different email
          address at registration. A single-use, expiring link is sent to the
          guardian, who can approve or decline. The workspace stays locked until
          consent is recorded. Consent, including its version and timestamp, is
          retained with the account. Guardians can withdraw consent by
          contacting the published privacy address.
        </p>
      </LegalSection>

      <LegalSection title="5. AI processing">
        <p>
          When enabled, the advisor runs through a server-side provider chosen
          by the operator. It receives a minimized summary of the signed-in
          student&apos;s profile and workspace, a bounded conversation history,
          the current question, and read-only catalog tools. It never receives
          other students&apos; data, raw document contents, passwords, or
          guardian contact details. Whether the provider retains or trains on
          submitted content is provider-dependent and must be confirmed in the
          deployment contract; do not put sensitive identifiers into a chat.
        </p>
      </LegalSection>

      <LegalSection title="6. Storage and security">
        <p>
          Documents are stored in private object storage, scanned for malware
          before they become available, and served only through an authenticated
          owner-checked route. Access tokens and API keys remain server-side.
          Production readiness checks require TLS, a configured public HTTPS
          origin, SMTP, private storage, a scanner endpoint, and redacted
          telemetry. No system is perfectly secure; if a breach affects personal
          data, the operator will follow applicable notification requirements.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention and deletion">
        <p>
          Account data is kept while the account is active. In Account settings
          you can delete your account after re-entering your password and typing{" "}
          <code>DELETE</code>. Deletion removes user-owned workspace records,
          documents, conversations, consent records, and access grants, and
          anonymises the retained account row. Append-only audit and
          catalog-review history are kept with opaque identifiers rather than
          personal details. Backup copies expire according to the
          operator&apos;s storage lifecycle policy, which is provider-dependent
          and must be configured before launch. A self-service export path is
          not implemented yet; contact the privacy address for access requests.
        </p>
      </LegalSection>

      <LegalSection title="8. Sharing and sale of data">
        <p>
          We do not sell personal data and do not operate an advertising
          business. Hosting, database, object-storage, email, breach-check,
          telemetry, and AI providers may process data on the operator&apos;s
          instructions under contractual safeguards. We may disclose data when
          legally required. International transfer mechanisms depend on where
          those providers operate and must be documented by the operator.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          Depending on your location, you may have the right to access, correct,
          export, or delete your data, withdraw consent, or object to certain
          processing. Use the published privacy contact on our{" "}
          <a href="/security" className="underline underline-offset-2">
            security and disclosure page
          </a>{" "}
          to make a request. We may verify your identity before acting so that
          we do not disclose or delete another person&apos;s data.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We will update this notice as the product develops and will make
          material changes visible. The date at the top shows when the current
          version was published.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
