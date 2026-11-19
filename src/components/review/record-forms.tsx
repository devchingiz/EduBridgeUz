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
  ELIGIBILITY_LABELS,
  ELIGIBILITY_SCOPES,
  FUNDING_LABELS,
  FUNDING_TYPES,
  REQUIREMENT_KINDS,
  REQUIREMENT_LABELS,
} from "@/lib/catalog/constants";
import { COUNTRY_OPTIONS } from "@/lib/data/countries";
import { DEGREE_LEVELS, STUDY_FIELDS } from "@/lib/data/fields";
import type { ReviewRecord } from "@/lib/catalog/queries";

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

function SourceBlock({
  errors,
  source,
  today,
}: {
  errors: Record<string, string>;
  source: ReviewRecord["source"];
  today: string;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-[13px] font-semibold">
        Source and verification
      </legend>
      <FormField id="sourceUrl" label="Source URL" error={errors.sourceUrl}>
        <Input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          defaultValue={source?.url ?? ""}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="publisher" label="Publisher" error={errors.publisher}>
          <Input
            id="publisher"
            name="publisher"
            defaultValue={source?.publisher ?? ""}
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
            defaultValue={source?.title ?? ""}
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
            defaultValue={source?.accessedAt || today}
            required
          />
        </FormField>
        <FormField
          id="verifiedAt"
          label="Verified on"
          error={errors.verifiedAt}
        >
          <Input
            id="verifiedAt"
            name="verifiedAt"
            type="date"
            defaultValue={source?.verifiedAt ?? ""}
          />
        </FormField>
      </div>
    </fieldset>
  );
}

export function RecordEditForm({
  record,
  action,
  universities,
  today,
}: {
  record: ReviewRecord;
  action: Action;
  universities: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const fields = record.fields;

  const degreeLevels = (fields.degreeLevels ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="entityType" value={record.entityType} />
      <input type="hidden" name="id" value={record.id} />
      <FormMessage state={state} />

      <div className="surface-card space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Name" error={errors.name}>
            <Input id="name" name="name" defaultValue={fields.name} required />
          </FormField>
          <FormField id="slug" label="URL slug" error={errors.slug}>
            <Input id="slug" name="slug" defaultValue={fields.slug} required />
          </FormField>

          {record.entityType === "UNIVERSITY" ? (
            <>
              <FormField
                id="shortName"
                label="Short name"
                optional
                error={errors.shortName}
              >
                <Input
                  id="shortName"
                  name="shortName"
                  defaultValue={fields.shortName}
                />
              </FormField>
              <FormField id="city" label="City" error={errors.city}>
                <Input
                  id="city"
                  name="city"
                  defaultValue={fields.city}
                  required
                />
              </FormField>
              <FormField
                id="countryCode"
                label="Country"
                error={errors.countryCode}
              >
                <Select
                  id="countryCode"
                  name="countryCode"
                  defaultValue={fields.countryCode}
                  required
                >
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
                  defaultValue={fields.websiteUrl}
                />
              </FormField>
            </>
          ) : null}

          {record.entityType === "PROGRAM" ? (
            <>
              <FormField
                id="universityId"
                label="University"
                error={errors.universityId}
              >
                <Select
                  id="universityId"
                  name="universityId"
                  defaultValue={fields.universityId}
                  required
                >
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="degreeLevel"
                label="Degree level"
                error={errors.degreeLevel}
              >
                <Select
                  id="degreeLevel"
                  name="degreeLevel"
                  defaultValue={fields.degreeLevel}
                  required
                >
                  {DEGREE_LEVELS.map((degree) => (
                    <option key={degree.value} value={degree.value}>
                      {degree.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="field" label="Field of study" error={errors.field}>
                <Select
                  id="field"
                  name="field"
                  defaultValue={fields.field}
                  required
                >
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
                <Input
                  id="language"
                  name="language"
                  defaultValue={fields.language}
                />
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
                  defaultValue={fields.durationMonths}
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
                  defaultValue={fields.credits}
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
                  defaultValue={fields.startNote}
                />
              </FormField>
            </>
          ) : null}

          {record.entityType === "SCHOLARSHIP" ? (
            <>
              <FormField
                id="providerName"
                label="Provider"
                error={errors.providerName}
              >
                <Input
                  id="providerName"
                  name="providerName"
                  defaultValue={fields.providerName}
                  required
                />
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
                  defaultValue={fields.providerUrl}
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
                  defaultValue={fields.hostCountryCode}
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
                  defaultValue={fields.fundingType}
                  required
                >
                  {FUNDING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FUNDING_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="nationalityScope"
                label="Nationality scope"
                error={errors.nationalityScope}
              >
                <Select
                  id="nationalityScope"
                  name="nationalityScope"
                  defaultValue={fields.nationalityScope}
                  required
                >
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
                hint="ISO codes separated by commas."
                error={errors.eligibleNationalities}
              >
                <Input
                  id="eligibleNationalities"
                  name="eligibleNationalities"
                  defaultValue={fields.eligibleNationalities}
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
                  defaultValue={fields.fieldScope}
                  required
                >
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
                <Input id="fields" name="fields" defaultValue={fields.fields} />
              </FormField>
            </>
          ) : null}
        </div>

        {record.entityType === "SCHOLARSHIP" ? (
          <>
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
                    <Checkbox
                      name="degreeLevels"
                      value={degree.value}
                      defaultChecked={degreeLevels.includes(degree.value)}
                    />
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
            <FormField id="summary" label="Summary" error={errors.summary}>
              <Textarea
                id="summary"
                name="summary"
                rows={4}
                defaultValue={fields.summary}
                required
              />
            </FormField>
          </>
        ) : null}
      </div>

      <div className="surface-card space-y-4 p-5 sm:p-6">
        <SourceBlock errors={errors} source={record.source} today={today} />
      </div>

      <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2.5 text-[12.5px] leading-5">
          <Checkbox name="publish" className="mt-0.5" />
          <span>
            Mark as verified now. Saving without this keeps the record in the
            review queue.
          </span>
        </label>
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function DecisionForm({
  entityType,
  id,
  action,
}: {
  entityType: string;
  id: string;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <FormField
        id="note"
        label="Reviewer note"
        optional
        hint="Required when requesting changes. Archive removes the record from public results and keeps its history."
        error={errors.note}
      >
        <Textarea id="note" name="note" rows={3} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="APPROVE" pendingLabel="Recording…">
          Approve as verified
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="REQUEST_CHANGES"
          variant="outline"
          pendingLabel="Recording…"
        >
          Request changes
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="EXPIRE"
          variant="outline"
          pendingLabel="Recording…"
        >
          Expire
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="RESTORE"
          variant="ghost"
          pendingLabel="Recording…"
        >
          Restore to review
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="MARK_PARTIAL"
          variant="outline"
          pendingLabel="Recording…"
        >
          Mark partially verified
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="MARK_UNAVAILABLE"
          variant="outline"
          pendingLabel="Recording…"
        >
          Mark info unavailable
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="ARCHIVE"
          variant="destructive"
          pendingLabel="Archiving…"
        >
          Archive record
        </SubmitButton>
      </div>
    </form>
  );
}

export function RequirementForm({
  entityType,
  id,
  action,
}: {
  entityType: string;
  id: string;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <FormField id="kind" label="Kind" error={errors.kind}>
          <Select id="kind" name="kind" defaultValue="ACADEMIC">
            {REQUIREMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {REQUIREMENT_LABELS[kind]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="summary" label="Requirement" error={errors.summary}>
          <Textarea id="summary" name="summary" rows={2} required />
        </FormField>
      </div>
      <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">
        Add requirement
      </SubmitButton>
    </form>
  );
}

export function TuitionForm({ id, action }: { id: string; action: Action }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="amount" label="Amount" error={errors.amount}>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="6000"
            required
          />
        </FormField>
        <FormField id="currency" label="Currency" error={errors.currency}>
          <Input
            id="currency"
            name="currency"
            placeholder="EUR"
            maxLength={3}
            required
          />
        </FormField>
        <FormField id="period" label="Period" error={errors.period}>
          <Input
            id="period"
            name="period"
            placeholder="per semester"
            required
          />
        </FormField>
        <FormField
          id="applicantGroup"
          label="Applies to"
          optional
          error={errors.applicantGroup}
        >
          <Input
            id="applicantGroup"
            name="applicantGroup"
            placeholder="International students from third countries"
          />
        </FormField>
        <FormField
          id="note"
          label="Note"
          optional
          error={errors.note}
          className="sm:col-span-2"
        >
          <Input id="note" name="note" />
        </FormField>
      </div>
      <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">
        Add tuition fact
      </SubmitButton>
    </form>
  );
}

export function DeadlineForm({
  entityType,
  id,
  action,
}: {
  entityType: string;
  id: string;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cycle" label="Cycle" error={errors.cycle}>
          <Input
            id="cycle"
            name="cycle"
            placeholder="Winter semester"
            required
          />
        </FormField>
        <FormField
          id="applicantGroup"
          label="Applies to"
          optional
          error={errors.applicantGroup}
        >
          <Input
            id="applicantGroup"
            name="applicantGroup"
            placeholder="All applicants"
          />
        </FormField>
        <FormField
          id="opensOn"
          label="Opens on"
          optional
          hint="Use an exact date only when the source gives a year."
          error={errors.opensOn}
        >
          <Input id="opensOn" name="opensOn" type="date" />
        </FormField>
        <FormField
          id="deadlineOn"
          label="Deadline on"
          optional
          error={errors.deadlineOn}
        >
          <Input id="deadlineOn" name="deadlineOn" type="date" />
        </FormField>
        <FormField
          id="opensMonthDay"
          label="Recurring opens"
          optional
          hint="MM-DD, for example 02-01."
          error={errors.opensMonthDay}
        >
          <Input id="opensMonthDay" name="opensMonthDay" placeholder="02-01" />
        </FormField>
        <FormField
          id="deadlineMonthDay"
          label="Recurring deadline"
          optional
          hint="MM-DD, for example 05-31."
          error={errors.deadlineMonthDay}
        >
          <Input
            id="deadlineMonthDay"
            name="deadlineMonthDay"
            placeholder="05-31"
          />
        </FormField>
      </div>
      <FormField
        id="note"
        label="Note"
        optional
        hint="Use a note when the source gives no exact date."
        error={errors.note}
      >
        <Textarea id="note" name="note" rows={2} />
      </FormField>
      <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">
        Add deadline
      </SubmitButton>
    </form>
  );
}
