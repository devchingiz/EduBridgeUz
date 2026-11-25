"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  changeUniversityStatusAction,
  importUniversitiesCsvAction,
  saveUniversityAction,
  setUniversityFeaturedAction,
  verifyUniversitySourceAction,
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
  CONTINENTS,
  INSTITUTION_TYPES,
  VERIFICATION_LABELS,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { COUNTRY_CODES, countryName } from "@/lib/data/countries";

export type UniversityEditorValues = {
  id?: string;
  name: string;
  slug: string;
  shortName: string;
  city: string;
  countryCode: string;
  websiteUrl: string;
  continent: string;
  institutionType: string;
  logoUrl: string;
  description: string;
  rankingOrganization: string;
  rankingEdition: string;
  rankingPosition: string;
  rankingDisplay: string;
  rankingTied: boolean;
  rankingIsRange: boolean;
  qsNid: string;
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

export const blankUniversityEditorValues: UniversityEditorValues = {
  name: "",
  slug: "",
  shortName: "",
  city: "",
  countryCode: "US",
  websiteUrl: "",
  continent: "",
  institutionType: "",
  logoUrl: "",
  description: "",
  rankingOrganization: "",
  rankingEdition: "",
  rankingPosition: "",
  rankingDisplay: "",
  rankingTied: false,
  rankingIsRange: false,
  qsNid: "",
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

/** Full administrator editor for every stored university profile field. */
export function UniversityEditorForm({
  values,
}: {
  values: UniversityEditorValues;
}) {
  const [state, formAction] = useActionState(
    saveUniversityAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="University name"
          name="name"
          defaultValue={values.name}
          required
        />
        <TextField
          label="URL slug"
          name="slug"
          defaultValue={values.slug}
          placeholder="oxford-university"
          required
        />
        <TextField
          label="Short name"
          name="shortName"
          defaultValue={values.shortName}
        />
        <TextField
          label="City"
          name="city"
          defaultValue={values.city}
          required
        />
        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Country</Label>
          <Select
            id="countryCode"
            name="countryCode"
            defaultValue={values.countryCode}
            required
          >
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label="Official website"
          name="websiteUrl"
          type="url"
          defaultValue={values.websiteUrl}
          placeholder="https://…"
        />
        <div className="space-y-1.5">
          <Label htmlFor="continent">Continent</Label>
          <Select
            id="continent"
            name="continent"
            defaultValue={values.continent}
          >
            <option value="">Unknown</option>
            {CONTINENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="institutionType">Institution type</Label>
          <Select
            id="institutionType"
            name="institutionType"
            defaultValue={values.institutionType}
          >
            <option value="">Unknown</option>
            {INSTITUTION_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label="Logo URL"
          name="logoUrl"
          type="url"
          defaultValue={values.logoUrl}
          placeholder="https://…"
        />
        <TextField
          label="QS numeric ID"
          name="qsNid"
          type="number"
          defaultValue={values.qsNid}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={values.description}
          rows={5}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Ranking organization"
          name="rankingOrganization"
          defaultValue={values.rankingOrganization}
        />
        <TextField
          label="Ranking edition"
          name="rankingEdition"
          defaultValue={values.rankingEdition}
          placeholder="QS 2027"
        />
        <TextField
          label="Ranking position"
          name="rankingPosition"
          type="number"
          defaultValue={values.rankingPosition}
        />
        <TextField
          label="Ranking display"
          name="rankingDisplay"
          defaultValue={values.rankingDisplay}
          placeholder="= 42 or 401–450"
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="rankingTied" defaultChecked={values.rankingTied} />
          Ranking is a tie
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="rankingIsRange"
            defaultChecked={values.rankingIsRange}
          />
          Ranking is a range
        </label>
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
        {values.id ? "Save changes" : "Create university"}
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
    changeUniversityStatusAction,
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

export function UniversityStatusActions({
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

export function UniversityFeatureControl({
  id,
  featured,
}: {
  id: string;
  featured: boolean;
}) {
  const [state, formAction] = useActionState(
    setUniversityFeaturedAction,
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
        {featured ? "Remove from featured" : "Feature university"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function UniversitySourceVerificationForm({
  id,
  verifiedAt,
}: {
  id: string;
  verifiedAt: string;
}) {
  const [state, formAction] = useActionState(
    verifyUniversitySourceAction,
    initialFormState,
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="verify-verifiedAt">Verified on</Label>
        <Input
          id="verify-verifiedAt"
          name="verifiedAt"
          type="date"
          defaultValue={verifiedAt}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="verify-accessedAt">Accessed on</Label>
        <Input id="verify-accessedAt" name="accessedAt" type="date" />
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

export function UniversityCsvImportForm() {
  const [state, formAction] = useActionState(
    importUniversitiesCsvAction,
    initialFormState,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import universities</CardTitle>
        <CardDescription>
          CSV with name, city, countryCode, sourceUrl, sourcePublisher,
          sourceTitle, and sourceAccessedAt. Maximum 200 rows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="university-csv">CSV file</Label>
            <Input
              id="university-csv"
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
          <Link href="/admin/universities/export">
            Download current catalog CSV
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
