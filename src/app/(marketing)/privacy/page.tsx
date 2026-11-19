import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How EduBridge intends to collect, use, protect, and delete personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      description="EduBridge is built for students, including minors. This notice explains what the public site collects today and how personal data will be handled when accounts open."
      updated="12 November 2026"
    >
      <div className="rounded-xl border border-emerald-600/20 bg-emerald-50/60 p-4 text-[13px] leading-6 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-200">
        <strong className="font-semibold">Current status:</strong> EduBridge
        does not yet offer accounts, document uploads, or an AI advisor. This
        marketing site does not ask you to submit student records.
      </div>

      <LegalSection title="1. Information collected today">
        <p>
          The public preview does not include registration forms, analytics
          scripts, advertising pixels, or document uploads. Our hosting and
          infrastructure providers may process standard technical data such as
          IP address, request time, browser type, and requested URL for
          security, reliability, and abuse prevention.
        </p>
        <p>
          Theme preference may be stored locally in your browser. It is not sent
          to our servers.
        </p>
      </LegalSection>

      <LegalSection title="2. Information planned for student accounts">
        <p>
          When accounts open, we intend to collect only what the service needs:
        </p>
        <LegalList
          items={[
            "Account details: name, email address, password hash, role, and verification status.",
            "Student profile: country of residence, nationality, age range, education level, intended degree and field, preferred countries, budget, scholarship preference, and optional test scores or GPA.",
            "Application data: saved universities and scholarships, application stages, notes, and deadlines.",
            "Documents you choose to upload, such as a passport, transcript, test certificate, recommendation letter, personal statement, or CV.",
            "AI advisor conversations and the profile context used to answer them.",
            "Notification preferences and essential security events.",
          ]}
        />
        <p>
          We do not intend to collect passport numbers, financial account
          details, health information, or other sensitive identifiers unless a
          specific application process requires it and the need is explained
          first.
        </p>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <LegalList
          items={[
            "To provide discovery, saving, comparison, and application tracking features.",
            "To generate profile-aware guidance and checklists.",
            "To send the deadline and document reminders you opt into.",
            "To secure accounts, prevent abuse, and diagnose failures.",
            "To meet legal obligations and respond to valid requests.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Minors and consent">
        <p>
          Many applicants are under 18. We will collect only information that is
          necessary for the service and will design consent flows that are
          understandable to students and guardians. Where local law requires
          guardian consent, we will ask for it before activating an account.
          Students will be able to request deletion of their data.
        </p>
      </LegalSection>

      <LegalSection title="5. AI processing">
        <p>
          AI features will use a server-side model provider configured by
          EduBridge. Prompts may include the profile context needed to answer a
          question. Before launch, we will publish the provider category,
          retention terms, and a clear explanation of what is sent. Do not put
          sensitive identifiers into an AI chat.
        </p>
      </LegalSection>

      <LegalSection title="6. Storage and security">
        <p>
          Documents will be stored in private object storage, not in a public
          folder. Access will be scoped to the authenticated owner, uploads will
          be validated, and file URLs will not be publicly listed.
          Authentication secrets and API keys are kept server-side and never
          shipped to the browser.
        </p>
        <p>
          No system is perfectly secure. If a breach affects personal data, we
          will follow applicable notification requirements.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention and deletion">
        <p>
          Account data will be retained while an account is active and for a
          limited period afterward where needed for backups, dispute resolution,
          or legal obligations. A deletion request will remove active records
          and schedule backup copies for expiry. Specific retention periods will
          be published before accounts open.
        </p>
      </LegalSection>

      <LegalSection title="8. Sharing and sale of data">
        <p>
          We do not sell personal data and do not intend to operate an
          advertising business. Service providers such as hosting, database,
          storage, email, and AI providers may process data on our instructions
          under contractual safeguards. We may disclose data when legally
          required.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          Depending on your location, you may have the right to access, correct,
          export, or delete your data, withdraw consent, or object to certain
          processing. A dedicated privacy contact and request process will be
          published before accounts open.
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
