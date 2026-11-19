import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Data sources and verification",
  description:
    "How EduBridge sources, verifies, dates, and reviews university and scholarship information.",
};

export default function DataSourcesPage() {
  return (
    <LegalPage
      title="Data sources and verification"
      description="University and scholarship information changes constantly. This is the standard we use to decide what can be published — and how uncertainty is shown."
      updated="19 November 2026"
    >
      <LegalSection title="1. Source before claim">
        <p>
          Important facts must be traceable to an official source before they
          can be presented as current. Each record is designed to store:
        </p>
        <LegalList
          items={[
            "The official source URL.",
            "The publishing organization, such as a university admissions office or scholarship provider.",
            "The date the information was captured and the date it was last verified.",
            "The verification state and any reviewer notes.",
            "A review or expiry date so the record can be rechecked when a cycle changes.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Verification states">
        <LegalList
          items={[
            "Verified: reviewed against an official source, with a current verification date.",
            "Partially verified: sourced from a recognised third-party index such as QS, but not checked against the institution's own current page.",
            "Information unavailable: no trustworthy source value exists. The profile says so explicitly instead of guessing.",
            "Not verified: collected but not yet confirmed. It is visibly marked and not treated as authoritative.",
            "Needs review: conflicting, incomplete, or recently changed information that a human must check.",
            "Expired: previously verified, but past its review window. It must not be presented as current.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Rankings">
        <p>
          A ranking is only displayed when it is supported by a named ranking
          source and a specific year. The global university catalog uses QS
          World University Rankings 2027, published on 18 June 2026, as its
          primary ranking reference. Exact QS strings are preserved, including
          ties such as “=2” and ranges such as “951-1000”. We do not merge
          incompatible rankings, invent a composite score, or present an
          unlabeled number as a global ranking. Unranked institutions are marked
          unavailable rather than assigned an inferred position.
        </p>
      </LegalSection>

      <LegalSection title="4. Tuition, deadlines, and requirements">
        <p>
          Tuition figures must state the intake year, currency, and what the
          amount covers. Deadlines must state the cycle and whether they apply
          to a specific program, campus, or applicant group. English and test
          requirements must reflect the program level and any exemptions. Where
          an official source is ambiguous, the record is flagged for review or
          left unpublished.
        </p>
      </LegalSection>

      <LegalSection title="5. Scholarships">
        <p>
          Scholarship records must link to the provider&apos;s official rules.
          Eligibility fields are explanatory, not a decision. A student may see
          that some criteria match while others are unknown; EduBridge never
          guarantees funding.
        </p>
      </LegalSection>

      <LegalSection title="6. Collection and automation">
        <p>
          If automated collection is introduced, it will respect website terms,
          robots.txt, and access controls. Official APIs are preferred. We will
          not bypass authentication, paywalls, or rate limits. Automated
          extraction never skips human review for uncertain facts.
        </p>
      </LegalSection>

      <LegalSection title="7. Catalog coverage and limitations">
        <p>
          The catalog contains 500 distinct universities. QS public institution
          and programme indexes supply names, locations, QS 2027 positions,
          programme names, levels, durations and indicative fees. Wikidata P856
          claims supply official websites where a confident match exists. QS
          indicative fees are not official university fee sheets, and a QS
          programme listing is not a guarantee of English-language instruction.
        </p>
        <p>
          The sources do not provide IELTS/TOEFL/SAT minima, application
          deadlines, intake months, founded years, contact details, individual
          scholarship awards, or guaranteed language-of-instruction data for
          every record. Those fields are explicitly marked “Information
          unavailable”. The eight university profiles in the landing-page search
          remain hand-checked interface examples.
        </p>
      </LegalSection>

      <LegalSection title="8. Corrections">
        <p>
          A public correction channel will be published before the live catalog
          opens. Corrections will update the source record, verification state,
          and reviewer history rather than silently overwriting the past.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
