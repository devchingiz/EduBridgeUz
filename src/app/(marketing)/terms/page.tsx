import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms for using the EduBridge application and catalog.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      description="These terms govern use of the EduBridge application, including accounts, private workspace features, and the source-linked catalog."
      updated="24 November 2026"
    >
      <div className="rounded-xl border border-amber-600/20 bg-amber-50/60 p-4 text-[13px] leading-6 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-100">
        <strong className="font-semibold">Before launch:</strong> this build
        implements account creation, document uploads, application tracking, and
        an optional AI advisor. The operator must complete legal review and
        publish final liability, consumer-protection, and governing-law terms
        before production traffic. Those items are not decided here.
      </div>

      <LegalSection title="1. Scope and account acceptance">
        <p>
          Registration requires accurate account details, acceptance of these
          terms and the privacy notice, and a valid date of birth. Acceptance is
          recorded with a timestamp and policy version. Minors require guardian
          approval before their workspace unlocks. We may suspend accounts that
          threaten the service or other users.
        </p>
      </LegalSection>

      <LegalSection title="2. Informational purpose">
        <p>
          University and scholarship content is provided for research and
          organization. It is not legal, immigration, financial, or admissions
          advice. You are responsible for confirming requirements, fees,
          deadlines, and eligibility with the official institution or provider
          before making a decision.
        </p>
      </LegalSection>

      <LegalSection title="3. No guaranteed outcomes">
        <p>
          EduBridge does not guarantee admission, a scholarship, a visa, or any
          particular funding outcome. Match and eligibility explanations are
          informational. The AI advisor does not make final admissions decisions
          and its output must not be presented as official guidance.
        </p>
      </LegalSection>

      <LegalSection title="4. Catalog accuracy and provenance">
        <p>
          Published catalog records carry a human-verified source and
          verification date, and changes are kept in an append-only review
          history. Records explicitly labeled as sample data must not be relied
          on as current. If you believe a record is incorrect, use the published
          contact on our{" "}
          <a href="/security" className="underline underline-offset-2">
            security and disclosure page
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <LegalList
          items={[
            "Do not attempt to access another student's account, documents, or application data.",
            "Do not upload malware, attempt to execute uploaded files, or bypass upload validation.",
            "Do not scrape, overload, or interfere with the service or its security controls.",
            "Do not use AI features to impersonate an institution or present generated advice as official guidance.",
            "Do not use the service for unlawful discrimination or fraudulent applications.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Accounts and security">
        <p>
          Keep your credentials private, enable two-factor authentication where
          available, and notify us of suspected unauthorized access. You can
          review active sessions and revoke them in Account settings. Email
          verification, guardian consent, rate limits, and audit logging are
          used to protect accounts; they are not a guarantee against all misuse.
        </p>
      </LegalSection>

      <LegalSection title="7. Your files and data">
        <p>
          You retain responsibility for documents you upload and for ensuring
          you have the right to share them. You can delete documents and your
          account in the application; deletion and retention details are
          described in the privacy notice. Do not put another person&apos;s
          private information into the service without their permission.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          The EduBridge name, interface, and original content are protected by
          applicable intellectual property laws. University names, logos,
          rankings, and scholarship materials remain the property of their
          respective owners and are used for identification and reference.
        </p>
      </LegalSection>

      <LegalSection title="9. Third-party links and providers">
        <p>
          Official university and scholarship links are provided for your
          convenience. We do not control third-party sites and are not
          responsible for their content, availability, or privacy practices.
          Optional features such as Google sign-in, AI guidance, and email
          delivery depend on external providers configured by the operator.
        </p>
      </LegalSection>

      <LegalSection title="10. Availability and changes">
        <p>
          Features may change or be unavailable without notice. We may update
          these terms as the product develops. Continued use after an update
          means you accept the revised terms. Final liability,
          consumer-protection, and governing-law provisions must be published by
          the operator before production launch.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
