"use client";

import { useActionState } from "react";

import { saveHomepageAction } from "@/app/admin/content-actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
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
  HOMEPAGE_HREFS,
  type HomepageContent,
} from "@/lib/cms/homepage-content";

type CtaValue = { label: string; href: string };

function FieldErrors({ state }: { state: FormState }) {
  if (!state.fieldErrors) return null;
  const entries = Object.entries(state.fieldErrors);
  if (entries.length === 0) return null;
  return (
    <ul className="text-destructive mt-3 list-disc space-y-1 pl-5 text-[12px]">
      {entries.slice(0, 24).map(([field, message]) => (
        <li key={field}>
          <strong className="font-medium">{field}:</strong> {message}
        </li>
      ))}
      {entries.length > 24 ? (
        <li>Additional fields also need attention.</li>
      ) : null}
    </ul>
  );
}

function TextField({
  label,
  name,
  value,
  rows,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {rows ? (
        <Textarea
          id={name}
          name={name}
          defaultValue={value}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <Input
          id={name}
          name={name}
          defaultValue={value}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function HrefField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={value}>
        {HOMEPAGE_HREFS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}

function CtaFields({
  legend,
  prefix,
  value,
}: {
  legend: string;
  prefix: string;
  value: CtaValue;
}) {
  return (
    <fieldset className="border-border space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-[12px] font-medium">{legend}</legend>
      <TextField label="Label" name={`${prefix}.label`} value={value.label} />
      <HrefField
        label="Internal destination"
        name={`${prefix}.href`}
        value={value.href}
      />
    </fieldset>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function ObjectList({
  title,
  prefix,
  items,
  fields,
}: {
  title: string;
  prefix: string;
  items: readonly Record<string, string>[];
  fields: readonly { key: string; label: string; rows?: number }[];
}) {
  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <p className="text-[12px] font-medium">{title}</p>
      {items.map((item, index) => (
        <fieldset
          key={index}
          className="border-border/70 space-y-3 border-t pt-3"
        >
          <legend className="text-muted-foreground px-1 text-[11px] font-medium uppercase">
            Item {index + 1}
          </legend>
          {fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              name={`${prefix}.${index}.${field.key}`}
              value={item[field.key] ?? ""}
              rows={field.rows}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/** Flat-field editor for the strict homepage CMS document. */
export function HomepageEditorForm({ values }: { values: HomepageContent }) {
  const [state, formAction] = useActionState(
    saveHomepageAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <Section
        title="Hero"
        description="The first message visitors see. All values are plain text; links are limited to internal destinations."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Badge"
            name="hero.eyebrow"
            value={values.hero.eyebrow}
          />
          <TextField
            label="Highlighted title"
            name="hero.titleAccent"
            value={values.hero.titleAccent}
          />
        </div>
        <TextField
          label="Title"
          name="hero.titleLead"
          value={values.hero.titleLead}
        />
        <TextField
          label="Description"
          name="hero.description"
          value={values.hero.description}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CtaFields
            legend="Primary action"
            prefix="hero.primaryCta"
            value={values.hero.primaryCta}
          />
          <CtaFields
            legend="Secondary action"
            prefix="hero.secondaryCta"
            value={values.hero.secondaryCta}
          />
        </div>
        <TextField
          label="Trust pillars (one per line)"
          name="hero.pillars"
          value={values.hero.pillars.join("\n")}
          rows={3}
        />
      </Section>

      <Section
        title="Discovery and process"
        description="Headings and supporting copy for the university search and how-it-works sections."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="University eyebrow"
            name="universitySearch.eyebrow"
            value={values.universitySearch.eyebrow}
          />
          <TextField
            label="University title"
            name="universitySearch.title"
            value={values.universitySearch.title}
          />
        </div>
        <TextField
          label="University description"
          name="universitySearch.description"
          value={values.universitySearch.description}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="University link label"
            name="universitySearch.linkLabel"
            value={values.universitySearch.linkLabel}
          />
          <HrefField
            label="University link destination"
            name="universitySearch.linkHref"
            value={values.universitySearch.linkHref}
          />
        </div>
        <div className="border-border space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="How-it-works eyebrow"
              name="howItWorks.eyebrow"
              value={values.howItWorks.eyebrow}
            />
            <TextField
              label="How-it-works title"
              name="howItWorks.title"
              value={values.howItWorks.title}
            />
          </div>
          <TextField
            label="How-it-works description"
            name="howItWorks.description"
            value={values.howItWorks.description}
            rows={3}
          />
          <ObjectList
            title="Process steps"
            prefix="howItWorks.steps"
            items={values.howItWorks.steps}
            fields={[
              { key: "title", label: "Title" },
              { key: "description", label: "Description", rows: 3 },
              { key: "meta", label: "Caption" },
            ]}
          />
        </div>
        <div className="border-border space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Workspace eyebrow"
              name="features.eyebrow"
              value={values.features.eyebrow}
            />
            <TextField
              label="Workspace title"
              name="features.title"
              value={values.features.title}
            />
          </div>
          <TextField
            label="Workspace description"
            name="features.description"
            value={values.features.description}
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Workspace link label"
              name="features.linkLabel"
              value={values.features.linkLabel}
            />
            <HrefField
              label="Workspace link destination"
              name="features.linkHref"
              value={values.features.linkHref}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Scholarships and advisor"
        description="Editable copy for the funding and AI guidance sections. Preview cards and icons stay controlled by the application."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Scholarship eyebrow"
            name="scholarships.eyebrow"
            value={values.scholarships.eyebrow}
          />
          <TextField
            label="Scholarship title"
            name="scholarships.title"
            value={values.scholarships.title}
          />
        </div>
        <TextField
          label="Scholarship description"
          name="scholarships.description"
          value={values.scholarships.description}
          rows={3}
        />
        <TextField
          label="Benefits (one per line)"
          name="scholarships.benefits"
          value={values.scholarships.benefits.join("\n")}
          rows={4}
        />
        <TextField
          label="Filter caption"
          name="scholarships.filtersNote"
          value={values.scholarships.filtersNote}
        />
        <TextField
          label="Filter chips (one per line)"
          name="scholarships.filterChips"
          value={values.scholarships.filterChips.join("\n")}
          rows={7}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Scholarship action label"
            name="scholarships.ctaLabel"
            value={values.scholarships.ctaLabel}
          />
          <HrefField
            label="Scholarship action destination"
            name="scholarships.ctaHref"
            value={values.scholarships.ctaHref}
          />
        </div>
        <TextField
          label="Live catalog note"
          name="scholarships.liveNote"
          value={values.scholarships.liveNote}
        />
        <div className="border-border space-y-4 border-t pt-4">
          <TextField
            label="Advisor badge"
            name="advisor.badge"
            value={values.advisor.badge}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Advisor title, first line"
              name="advisor.titleLine1"
              value={values.advisor.titleLine1}
            />
            <TextField
              label="Advisor title, second line"
              name="advisor.titleLine2"
              value={values.advisor.titleLine2}
            />
          </div>
          <TextField
            label="Advisor description"
            name="advisor.description"
            value={values.advisor.description}
            rows={3}
          />
          <ObjectList
            title="Advisor capabilities"
            prefix="advisor.capabilities"
            items={values.advisor.capabilities}
            fields={[
              { key: "title", label: "Title" },
              { key: "description", label: "Description", rows: 2 },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Disclaimer heading"
              name="advisor.disclaimerLead"
              value={values.advisor.disclaimerLead}
            />
            <TextField
              label="Disclaimer text"
              name="advisor.disclaimerBody"
              value={values.advisor.disclaimerBody}
              rows={3}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Trust and stories"
        description="Counts and trust labels are fixed; only the words describing them are editable."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Verification eyebrow"
            name="verification.eyebrow"
            value={values.verification.eyebrow}
          />
          <TextField
            label="Verification title"
            name="verification.title"
            value={values.verification.title}
          />
        </div>
        <TextField
          label="Verification description"
          name="verification.description"
          value={values.verification.description}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Verification link label"
            name="verification.linkLabel"
            value={values.verification.linkLabel}
          />
          <HrefField
            label="Verification link destination"
            name="verification.linkHref"
            value={values.verification.linkHref}
          />
        </div>
        <ObjectList
          title="Capability statistics"
          prefix="verification.stats"
          items={values.verification.stats}
          fields={[
            { key: "value", label: "Value" },
            { key: "label", label: "Label", rows: 2 },
          ]}
        />
        <TextField
          label="Statistics note"
          name="verification.note"
          value={values.verification.note}
          rows={3}
        />
        <ObjectList
          title="Verification principles"
          prefix="verification.principles"
          items={values.verification.principles}
          fields={[
            { key: "title", label: "Title" },
            { key: "description", label: "Description", rows: 3 },
          ]}
        />
        <TextField
          label="Status note"
          name="verification.statusesNote"
          value={values.verification.statusesNote}
        />
        <div className="border-border space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Stories eyebrow"
              name="testimonials.eyebrow"
              value={values.testimonials.eyebrow}
            />
            <TextField
              label="Stories title"
              name="testimonials.title"
              value={values.testimonials.title}
            />
          </div>
          <TextField
            label="Stories description"
            name="testimonials.description"
            value={values.testimonials.description}
            rows={3}
          />
          <TextField
            label="Placeholder quote"
            name="testimonials.quote"
            value={values.testimonials.quote}
            rows={4}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Placeholder badge"
              name="testimonials.placeholderLabel"
              value={values.testimonials.placeholderLabel}
            />
            <TextField
              label="Placeholder note"
              name="testimonials.placeholderNote"
              value={values.testimonials.placeholderNote}
            />
          </div>
          <TextField
            label="Commitment heading"
            name="testimonials.commitmentLabel"
            value={values.testimonials.commitmentLabel}
          />
          <TextField
            label="Commitments (one per line)"
            name="testimonials.commitments"
            value={values.testimonials.commitments.join("\n")}
            rows={3}
          />
        </div>
      </Section>

      <Section
        title="FAQ"
        description="Questions remain plain text. An optional link can be attached to each answer using an internal destination."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="FAQ eyebrow"
            name="faq.eyebrow"
            value={values.faq.eyebrow}
          />
          <TextField
            label="FAQ title"
            name="faq.title"
            value={values.faq.title}
          />
        </div>
        <TextField
          label="FAQ description"
          name="faq.description"
          value={values.faq.description}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="FAQ link label"
            name="faq.linkLabel"
            value={values.faq.linkLabel}
          />
          <HrefField
            label="FAQ link destination"
            name="faq.linkHref"
            value={values.faq.linkHref}
          />
        </div>
        <TextField
          label="Answer open by default (FAQ id)"
          name="faq.defaultOpen"
          value={values.faq.defaultOpen}
        />
        {values.faq.items.map((item, index) => (
          <div
            key={item.id}
            className="border-border space-y-3 rounded-lg border p-3"
          >
            <input
              type="hidden"
              name={`faq.items.${index}.id`}
              value={item.id}
            />
            <p className="text-muted-foreground text-[11px] font-medium uppercase">
              FAQ {index + 1} · {item.id}
            </p>
            <TextField
              label="Question"
              name={`faq.items.${index}.question`}
              value={item.question}
            />
            <TextField
              label="Answer"
              name={`faq.items.${index}.answer`}
              value={item.answer}
              rows={4}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Optional link label"
                name={`faq.items.${index}.link.label`}
                value={item.link?.label ?? ""}
              />
              <HrefField
                label="Optional link destination"
                name={`faq.items.${index}.link.href`}
                value={item.link?.href ?? "/data-sources"}
              />
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Closing call to action"
        description="The final invitation shown at the bottom of the homepage."
      >
        <TextField
          label="Badge"
          name="finalCta.badge"
          value={values.finalCta.badge}
        />
        <TextField
          label="Title"
          name="finalCta.title"
          value={values.finalCta.title}
        />
        <TextField
          label="Description"
          name="finalCta.description"
          value={values.finalCta.description}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CtaFields
            legend="Primary action"
            prefix="finalCta.primaryCta"
            value={values.finalCta.primaryCta}
          />
          <CtaFields
            legend="Secondary action"
            prefix="finalCta.secondaryCta"
            value={values.finalCta.secondaryCta}
          />
        </div>
        <TextField
          label="Closing note"
          name="finalCta.note"
          value={values.finalCta.note}
        />
      </Section>

      <FormMessage state={state} />
      <FieldErrors state={state} />
      <SubmitButton pendingLabel="Saving homepage…">Save homepage</SubmitButton>
    </form>
  );
}
