"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  changeScholarshipStatusAction,
  importScholarshipsCsvAction,
  saveScholarshipAction,
  setScholarshipFeaturedAction,
  verifyScholarshipSourceAction,
} from "@/app/admin/catalog-actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/actions/state";
import {
  ELIGIBILITY_LABELS,
  ELIGIBILITY_SCOPES,
  FUNDING_LABELS,
  FUNDING_TYPES,
  VERIFICATION_LABELS,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { COUNTRY_CODES, countryName } from "@/lib/data/countries";
import { DEGREE_LEVELS } from "@/lib/data/fields";

export type ScholarshipEditorValues = {
  id?: string;
  name: string;
  slug: string;
  providerName: string;
  providerUrl: string;
  hostCountryCode: string;
  fundingType: string;
  degreeLevels: string[];
  nationalityScope: string;
  eligibleNationalities: string[];
  fieldScope: string;
  fields: string[];
  summary: string;
  status?: VerificationStatusValue;
  source: {
    url: string;
    publisher: string;
    title: string;
    accessedAt: string;
    verifiedAt: string;
    notes: string;
  };
};

export const blankScholarshipEditorValues: ScholarshipEditorValues = {
  name: "",
  slug: "",
  providerName: "",
  providerUrl: "",
  hostCountryCode: "",
  fundingType: "FULLY_FUNDED",
  degreeLevels: [],
  nationalityScope: "ALL",
  eligibleNationalities: [],
  fieldScope: "ALL",
  fields: [],
  summary: "",
  source: {
    url: "",
    publisher: "",
    title: "",
    accessedAt: "",
    verifiedAt: "",
    notes: "",
  },
};

function FieldErrors({ state }: { state: FormState }) {
  if (!state.fieldErrors) return null;
  const entries = Object.entries(state.fieldErrors);
  if (entries.length === 0) return null;
  return (
    <ul className="text-destructive mt-2 list-disc space-y-1 pl-5 text-[12px]">
      {entries.map(([field, message]) => (
        <li key={field}>
          <strong className="font-medium">{field}:</strong> {message}
        </li>
      ))}
    </ul>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Full administrator editor for every stored scholarship profile field. */
export function ScholarshipEditorForm({
  values,
}: {
  values: ScholarshipEditorValues;
}) {
  const [state, formAction] = useActionState(
    saveScholarshipAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Scholarship name"
          name="name"
          defaultValue={values.name}
          required
        />
        <TextField
          label="URL slug"
          name="slug"
          defaultValue={values.slug}
          placeholder="global-opportunity-fund"
          required
        />
        <TextField
          label="Provider name"
          name="providerName"
          defaultValue={values.providerName}
          required
        />
        <TextField
          label="Provider URL"
          name="providerUrl"
          type="url"
          defaultValue={values.providerUrl}
          placeholder="https://…"
          required
        />
        <div className="space-y-1.5">
          <Label htmlFor="hostCountryCode">Host country</Label>
          <Select
            id="hostCountryCode"
            name="hostCountryCode"
            defaultValue={values.hostCountryCode}
          >
            <option value="">Multiple / unknown</option>
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fundingType">Funding type</Label>
          <Select
            id="fundingType"
            name="fundingType"
            defaultValue={values.fundingType}
            required
          >
            {FUNDING_TYPES.map((option) => (
              <option key={option} value={option}>
                {FUNDING_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="border-border space-y-4 border-t pt-5">
        <CheckboxGroup
          legend="Eligible degree levels"
          name="degreeLevels"
          options={DEGREE_LEVELS.map((degree) => ({
            value: degree.value,
            label: degree.label,
          }))}
          selected={values.degreeLevels}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nationalityScope">Nationality scope</Label>
            <Select
              id="nationalityScope"
              name="nationalityScope"
              defaultValue={values.nationalityScope}
              required
            >
              {ELIGIBILITY_SCOPES.map((option) => (
                <option key={option} value={option}>
                  {ELIGIBILITY_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fieldScope">Field of study scope</Label>
            <Select
              id="fieldScope"
              name="fieldScope"
              defaultValue={values.fieldScope}
              required
            >
              {ELIGIBILITY_SCOPES.map((option) => (
                <option key={option} value={option}>
                  {ELIGIBILITY_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <CheckboxGroup
          legend="Eligible nationalities (only used for a listed scope)"
          name="eligibleNationalities"
          options={COUNTRY_CODES.map((code) => ({
            value: code,
            label: countryName(code),
          }))}
          selected={values.eligibleNationalities}
        />
        <TextField
          label="Fields of study"
          name="fields"
          defaultValue={values.fields.join("|")}
          placeholder="Computer Science|Engineering"
        />
        <div className="space-y-1.5">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            name="summary"
            defaultValue={values.summary}
            rows={5}
            required
          />
        </div>
      </div>

      <div className="border-border space-y-4 border-t pt-5">
        <div>
          <h3 className="text-sm font-medium">Primary source</h3>
          <p className="text-muted-foreground mt-1 text-[12px]">
            Every published fact must point to an official source with a
            verification date.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Source URL"
            name="sourceUrl"
            type="url"
            defaultValue={values.source.url}
            required
          />
          <TextField
            label="Publisher"
            name="sourcePublisher"
            defaultValue={values.source.publisher}
            required
          />
          <TextField
            label="Source title"
            name="sourceTitle"
            defaultValue={values.source.title}
            required
          />
          <TextField
            label="Accessed on"
            name="sourceAccessedAt"
            type="date"
            defaultValue={values.source.accessedAt}
            required
          />
          <TextField
            label="Verified on"
            name="sourceVerifiedAt"
            type="date"
            defaultValue={values.source.verifiedAt}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceNotes">Source notes</Label>
          <Textarea
            id="sourceNotes"
            name="sourceNotes"
            defaultValue={values.source.notes}
            rows={2}
          />
        </div>
      </div>

      <label className="border-border flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          name="publish"
          defaultChecked={values.status === "VERIFIED"}
        />
        <span>
          <span className="font-medium">Publish immediately</span>
          <span className="text-muted-foreground mt-0.5 block text-[12px]">
            Requires a source verification date. Leave unchecked to save a draft
            or unpublish a live record.
          </span>
        </span>
      </label>

      <FormMessage state={state} />
      <FieldErrors state={state} />
      <SubmitButton pendingLabel="Saving…">
        {values.id ? "Save changes" : "Create scholarship"}
      </SubmitButton>
    </form>
  );
}

const STATUS_CONTROLS = [
  { action: "PUBLISH", label: "Publish", variant: "default" },
  { action: "UNPUBLISH", label: "Unpublish", variant: "secondary" },
  { action: "ARCHIVE", label: "Archive", variant: "destructive" },
  { action: "RESTORE", label: "Restore", variant: "outline" },
] as const;

function StatusControl({
  id,
  action,
  label,
  variant,
}: {
  id: string;
  action: (typeof STATUS_CONTROLS)[number]["action"];
  label: string;
  variant: (typeof STATUS_CONTROLS)[number]["variant"];
}) {
  const [state, formAction] = useActionState(
    changeScholarshipStatusAction,
    initialFormState,
  );
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <Input name="note" placeholder="Optional note" maxLength={600} />
      <SubmitButton size="sm" variant={variant} pendingLabel="Working…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ScholarshipStatusActions({
  id,
  status,
  featured,
}: {
  id: string;
  status: VerificationStatusValue;
  featured: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[12px]">
        Current state: <strong>{VERIFICATION_LABELS[status]}</strong>
        {featured ? " · Featured" : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_CONTROLS.map((control) => (
          <StatusControl
            key={control.action}
            id={id}
            action={control.action}
            label={control.label}
            variant={control.variant}
          />
        ))}
      </div>
    </div>
  );
}

export function ScholarshipFeatureControl({
  id,
  featured,
}: {
  id: string;
  featured: boolean;
}) {
  const [state, formAction] = useActionState(
    setScholarshipFeaturedAction,
    initialFormState,
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="featured"
        value={featured ? "false" : "true"}
      />
      <SubmitButton size="sm" variant="outline" pendingLabel="Working…">
        {featured ? "Remove from featured" : "Feature scholarship"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ScholarshipSourceVerificationForm({
  id,
  verifiedAt,
}: {
  id: string;
  verifiedAt: string;
}) {
  const [state, formAction] = useActionState(
    verifyScholarshipSourceAction,
    initialFormState,
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="scholarship-verify-verifiedAt">Verified on</Label>
        <Input
          id="scholarship-verify-verifiedAt"
          name="verifiedAt"
          type="date"
          defaultValue={verifiedAt}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scholarship-verify-accessedAt">Accessed on</Label>
        <Input
          id="scholarship-verify-accessedAt"
          name="accessedAt"
          type="date"
        />
      </div>
      <div className="flex items-end">
        <SubmitButton size="sm" pendingLabel="Recording…">
          Record verification
        </SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ScholarshipCsvImportForm() {
  const [state, formAction] = useActionState(
    importScholarshipsCsvAction,
    initialFormState,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import scholarships</CardTitle>
        <CardDescription>
          CSV with name, providerName, providerUrl, fundingType, degreeLevels,
          nationalityScope, fieldScope, summary, sourceUrl, sourcePublisher,
          sourceTitle, and sourceAccessedAt. Join multi-value cells with |.
          Maximum 200 rows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scholarship-csv">CSV file</Label>
            <Input
              id="scholarship-csv"
              name="csv"
              type="file"
              accept=".csv,text/csv"
              required
            />
          </div>
          <SubmitButton size="sm" variant="outline" pendingLabel="Importing…">
            Import CSV
          </SubmitButton>
        </form>
        <FormMessage state={state} />
        <Button asChild variant="link" size="sm" className="px-0">
          <Link href="/admin/scholarships/export">
            Download current catalog CSV
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
