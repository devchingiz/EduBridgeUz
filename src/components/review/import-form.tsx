"use client";

import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/actions/state";
import {
  ELIGIBILITY_SCOPES,
  ELIGIBILITY_LABELS,
  FUNDING_LABELS,
  FUNDING_TYPES,
  REQUIREMENT_KINDS,
  REQUIREMENT_LABELS,
} from "@/lib/catalog/constants";
import { COUNTRY_OPTIONS } from "@/lib/data/countries";
import { DEGREE_LEVELS, STUDY_FIELDS } from "@/lib/data/fields";

type EntityType = "UNIVERSITY" | "PROGRAM" | "SCHOLARSHIP";

export type ImportAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;

const FACTS_PLACEHOLDER = `{
  "requirements": [
    { "kind": "ACADEMIC", "summary": "A recognized bachelor's degree in a related field." }
  ],
  "tuition": [
    {
      "amount": "6000",
      "currency": "EUR",
      "period": "per semester",
      "applicantGroup": "International students from third countries",
      "note": null
    }
  ],
  "deadlines": [
    {
      "cycle": "Winter semester",
      "applicantGroup": "All applicants",
      "opensMonthDay": "02-01",
      "deadlineMonthDay": "05-31",
      "note": null
    }
  ]
}`;

function SourceFields({
  errors,
  today,
}: {
  errors: Record<string, string>;
  today: string;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-[13px] font-semibold">Official source</legend>
      <p className="text-muted-foreground text-[12px] leading-5">
        A record cannot be published without a full URL and the date a human
        checked it. Use the provider&apos;s own page, not an aggregator.
      </p>
      <FormField id="sourceUrl" label="Source URL" error={errors.sourceUrl}>
        <Input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          placeholder="https://www.example.edu/program"
          required
          aria-invalid={Boolean(errors.sourceUrl)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="publisher" label="Publisher" error={errors.publisher}>
          <Input
            id="publisher"
            name="publisher"
            placeholder="University admissions office"
            required
          />
        </FormField>
        <FormField
          id="sourceTitle"
          label="Source title"
          error={errors.sourceTitle}
        >
          <Input
            id="sourceTitle"
            name="sourceTitle"
            placeholder="Program page title"
            required
          />
        </FormField>
        <FormField
          id="accessedAt"
          label="Accessed on"
          error={errors.accessedAt}
        >
          <Input
            id="accessedAt"
            name="accessedAt"
            type="date"
            defaultValue={today}
            required
          />
        </FormField>
        <FormField
          id="verifiedAt"
          label="Verified on"
          error={errors.verifiedAt}
          hint="The date you last checked this page."
        >
          <Input
            id="verifiedAt"
            name="verifiedAt"
            type="date"
            defaultValue={today}
          />
        </FormField>
      </div>
      <FormField
        id="sourceNotes"
        label="Source notes"
        optional
        error={errors.sourceNotes}
      >
        <Textarea
          id="sourceNotes"
          name="sourceNotes"
          rows={2}
          placeholder="Anything a future reviewer should know about this page."
        />
      </FormField>
    </fieldset>
  );
}

export function ImportForm({
  entityType,
  action,
  universities,
  today,
}: {
  entityType: EntityType;
  action: ImportAction;
  universities: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="entityType" value={entityType} />
      <FormMessage state={state} />

      <div className="surface-card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold">Record fields</h2>
          <p className="text-muted-foreground mt-1 text-[12px] leading-5">
            Enter only what the official page states. Leave a field empty when
            the source does not answer it.
          </p>
        </div>

        {entityType === "UNIVERSITY" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="name" label="University name" error={errors.name}>
                <Input id="name" name="name" required />
              </FormField>
              <FormField
                id="shortName"
                label="Short name"
                optional
                error={errors.shortName}
              >
                <Input id="shortName" name="shortName" />
              </FormField>
              <FormField id="slug" label="URL slug" error={errors.slug}>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="university-name"
                  required
                />
              </FormField>
              <FormField id="city" label="City" error={errors.city}>
                <Input id="city" name="city" required />
              </FormField>
              <FormField
                id="countryCode"
                label="Country"
                error={errors.countryCode}
              >
                <Select
                  id="countryCode"
                  name="countryCode"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a country
                  </option>
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="websiteUrl"
                label="Official website"
                optional
                hint="Leave blank when no authoritative website is available."
                error={errors.websiteUrl}
              >
                <Input
                  id="websiteUrl"
                  name="websiteUrl"
                  type="url"
                  placeholder="https://www.example.edu/"
                />
              </FormField>
            </div>
          </>
        ) : null}

        {entityType === "PROGRAM" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="universityId"
                label="University"
                error={errors.universityId}
              >
                <Select
                  id="universityId"
                  name="universityId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a university
                  </option>
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="name" label="Program name" error={errors.name}>
                <Input id="name" name="name" required />
              </FormField>
              <FormField id="slug" label="URL slug" error={errors.slug}>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="msc-computer-science"
                  required
                />
              </FormField>
              <FormField
                id="degreeLevel"
                label="Degree level"
                error={errors.degreeLevel}
              >
                <Select
                  id="degreeLevel"
                  name="degreeLevel"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a degree
                  </option>
                  {DEGREE_LEVELS.map((degree) => (
                    <option key={degree.value} value={degree.value}>
                      {degree.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="field" label="Field of study" error={errors.field}>
                <Select id="field" name="field" required defaultValue="">
                  <option value="" disabled>
                    Select a field
                  </option>
                  {STUDY_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="language"
                label="Language"
                optional
                error={errors.language}
              >
                <Input id="language" name="language" placeholder="English" />
              </FormField>
              <FormField
                id="durationMonths"
                label="Duration (months)"
                optional
                error={errors.durationMonths}
              >
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min={1}
                  max={120}
                />
              </FormField>
              <FormField
                id="credits"
                label="Credits"
                optional
                error={errors.credits}
              >
                <Input
                  id="credits"
                  name="credits"
                  type="number"
                  min={1}
                  max={600}
                />
              </FormField>
              <FormField
                id="startNote"
                label="Start (source wording)"
                optional
                error={errors.startNote}
              >
                <Input
                  id="startNote"
                  name="startNote"
                  placeholder="Winter and summer semester"
                />
              </FormField>
            </div>
          </>
        ) : null}

        {entityType === "SCHOLARSHIP" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="name" label="Scholarship name" error={errors.name}>
                <Input id="name" name="name" required />
              </FormField>
              <FormField id="slug" label="URL slug" error={errors.slug}>
                <Input id="slug" name="slug" required />
              </FormField>
              <FormField
                id="providerName"
                label="Provider"
                error={errors.providerName}
              >
                <Input id="providerName" name="providerName" required />
              </FormField>
              <FormField
                id="providerUrl"
                label="Provider website"
                error={errors.providerUrl}
              >
                <Input
                  id="providerUrl"
                  name="providerUrl"
                  type="url"
                  required
                />
              </FormField>
              <FormField
                id="hostCountryCode"
                label="Host country"
                optional
                error={errors.hostCountryCode}
              >
                <Select
                  id="hostCountryCode"
                  name="hostCountryCode"
                  defaultValue=""
                >
                  <option value="">Multiple countries / not stated</option>
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="fundingType"
                label="Funding type"
                error={errors.fundingType}
              >
                <Select
                  id="fundingType"
                  name="fundingType"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select funding type
                  </option>
                  {FUNDING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FUNDING_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-[12.5px] font-medium">
                Degree levels
              </legend>
              <div className="flex flex-wrap gap-3">
                {DEGREE_LEVELS.map((degree) => (
                  <label
                    key={degree.value}
                    className="flex items-center gap-2 text-[12.5px]"
                  >
                    <Checkbox name="degreeLevels" value={degree.value} />
                    {degree.label}
                  </label>
                ))}
              </div>
              {errors.degreeLevels ? (
                <p className="text-[12px] text-red-600 dark:text-red-400">
                  {errors.degreeLevels}
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="nationalityScope"
                label="Nationality scope"
                error={errors.nationalityScope}
              >
                <Select
                  id="nationalityScope"
                  name="nationalityScope"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select scope
                  </option>
                  {ELIGIBILITY_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {ELIGIBILITY_LABELS[scope]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="eligibleNationalities"
                label="Eligible nationalities"
                optional
                hint="ISO codes separated by commas, for example UZ, KZ."
                error={errors.eligibleNationalities}
              >
                <Input
                  id="eligibleNationalities"
                  name="eligibleNationalities"
                  placeholder="UZ"
                />
              </FormField>
              <FormField
                id="fieldScope"
                label="Field scope"
                error={errors.fieldScope}
              >
                <Select
                  id="fieldScope"
                  name="fieldScope"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select scope
                  </option>
                  {ELIGIBILITY_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {ELIGIBILITY_LABELS[scope]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="fields"
                label="Eligible fields"
                optional
                hint="Separate fields with commas."
                error={errors.fields}
              >
                <Input
                  id="fields"
                  name="fields"
                  placeholder="STEM, Public Health"
                />
              </FormField>
            </div>

            <FormField id="summary" label="Summary" error={errors.summary}>
              <Textarea
                id="summary"
                name="summary"
                rows={4}
                required
                placeholder="What the provider states, in your own words, without adding claims."
              />
            </FormField>
          </>
        ) : null}
      </div>

      <div className="surface-card space-y-4 p-5 sm:p-6">
        <SourceFields errors={errors} today={today} />
      </div>

      {entityType !== "UNIVERSITY" ? (
        <div className="surface-card space-y-3 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold">Facts</h2>
            <p className="text-muted-foreground mt-1 text-[12px] leading-5">
              Optional JSON. Every fact is attached to the primary source and
              marked verified. Leave empty to add facts one at a time on the
              record page.
            </p>
          </div>
          <FormField
            id="facts"
            label="Facts JSON"
            optional
            error={errors.facts}
          >
            <Textarea
              id="facts"
              name="facts"
              rows={10}
              className="font-mono text-[12px]"
              placeholder={FACTS_PLACEHOLDER}
            />
          </FormField>
          <p className="text-muted-foreground text-[11.5px] leading-5">
            Requirement kinds:{" "}
            {REQUIREMENT_KINDS.map((kind) => REQUIREMENT_LABELS[kind]).join(
              ", ",
            )}
            .
          </p>
        </div>
      ) : null}

      <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2.5 text-[12.5px] leading-5">
          <Checkbox name="publish" defaultChecked className="mt-0.5" />
          <span>
            Publish as verified now. The source must have a verification date.
            Leave unchecked to queue the record for review.
          </span>
        </label>
        <SubmitButton pendingLabel="Saving…">Save record</SubmitButton>
      </div>
    </form>
  );
}
