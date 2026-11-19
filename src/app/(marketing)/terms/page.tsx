import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Terms for using the EduBridge pre-launch preview and future platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      description="These terms govern the EduBridge pre-launch preview. They will be replaced by complete platform terms before accounts and paid services open."
      updated="12 November 2026"
    >
      <LegalSection title="1. Preview scope">
        <p>
          EduBridge is currently a product preview. Accounts, document uploads,
          AI conversations, application tracking, and personalized
          recommendations are not yet available. Features shown on the marketing
          site are illustrative of the intended product.
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
          informational. The AI advisor does not make final admissions
          decisions.
        </p>
      </LegalSection>

      <LegalSection title="4. Data accuracy">
        <p>
          We aim to publish only source-linked, dated information. Some content
          on this preview is explicitly labeled as sample data and must not be
          relied on as current. If you believe a record is incorrect, a
          correction process will be published before the live catalog opens.
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
          When accounts open, you must provide accurate information, keep your
          credentials private, and notify us of suspected unauthorized access.
          We may suspend accounts that threaten the service or other users.
        </p>
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          The EduBridge name, interface, and original content are protected by
          applicable intellectual property laws. University names, logos,
          rankings, and scholarship materials remain the property of their
          respective owners and are used for identification and reference.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party links">
        <p>
          Official university and scholarship links are provided for your
          convenience. We do not control third-party sites and are not
          responsible for their content, availability, or privacy practices.
        </p>
      </LegalSection>

      <LegalSection title="9. Availability and changes">
        <p>
          The preview may change or be unavailable without notice. We may update
          these terms as the product develops. Continued use after an update
          means you accept the revised terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Liability and governing law">
        <p>
          The preview is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis to the extent permitted by law. Final
          liability, consumer-protection, and governing-law provisions will be
          published before accounts open.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
