"use client";

import { useActionState, useState } from "react";

import { updateProfileAction } from "@/app/dashboard/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/lib/actions/state";
import { COUNTRY_OPTIONS } from "@/lib/data/countries";
import {
  BUDGET_CURRENCIES,
  DEGREE_LEVELS,
  ENGLISH_TESTS,
  STUDY_FIELDS,
} from "@/lib/data/fields";

export type ProfileDefaults = {
  name: string;
  nationality: string;
  residenceCountry: string;
  currentDegree: string;
  targetDegree: string;
  fieldsOfStudy: string[];
  englishTest: string;
  englishScore: string;
  budgetAmount: string;
  budgetCurrency: string;
  guardianName: string;
  guardianEmail: string;
};

const MAX_FIELDS = 6;

export function ProfileForm({
  defaults,
  isMinor,
}: {
  defaults: ProfileDefaults;
  isMinor: boolean;
}) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  const [selectedFields, setSelectedFields] = useState<string[]>(
    defaults.fieldsOfStudy,
  );

  const tooManyFields = selectedFields.length > MAX_FIELDS;

  function toggleField(field: string, checked: boolean) {
    setSelectedFields((current) =>
      checked
        ? [...current.filter((value) => value !== field), field]
        : current.filter((value) => value !== field),
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <section className="surface-card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold">About you</h2>
          <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
            This stays private to your workspace. It helps us show relevant
            universities and scholarships.
          </p>
        </div>

        <FormField id="name" label="Full name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={defaults.name}
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="nationality"
            label="Nationality"
            error={errors.nationality}
          >
            <Select
              id="nationality"
              name="nationality"
              defaultValue={defaults.nationality}
              aria-invalid={Boolean(errors.nationality)}
              aria-describedby={
                errors.nationality ? "nationality-error" : undefined
              }
            >
              <option value="">Select nationality</option>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="residenceCountry"
            label="Country of residence"
            error={errors.residenceCountry}
          >
            <Select
              id="residenceCountry"
              name="residenceCountry"
              defaultValue={defaults.residenceCountry}
              aria-invalid={Boolean(errors.residenceCountry)}
              aria-describedby={
                errors.residenceCountry ? "residenceCountry-error" : undefined
              }
            >
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section className="surface-card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold">Study plans</h2>
          <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
            Tell us what you want to study so matches are relevant from day one.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="currentDegree"
            label="Current or highest degree"
            error={errors.currentDegree}
            optional
          >
            <Select
              id="currentDegree"
              name="currentDegree"
              defaultValue={defaults.currentDegree}
              aria-invalid={Boolean(errors.currentDegree)}
              aria-describedby={
                errors.currentDegree ? "currentDegree-error" : undefined
              }
            >
              <option value="">Select degree</option>
              {DEGREE_LEVELS.map((degree) => (
                <option key={degree.value} value={degree.value}>
                  {degree.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="targetDegree"
            label="Target degree"
            error={errors.targetDegree}
          >
            <Select
              id="targetDegree"
              name="targetDegree"
              defaultValue={defaults.targetDegree}
              aria-invalid={Boolean(errors.targetDegree)}
              aria-describedby={
                errors.targetDegree ? "targetDegree-error" : undefined
              }
            >
              <option value="">Select degree</option>
              {DEGREE_LEVELS.map((degree) => (
                <option key={degree.value} value={degree.value}>
                  {degree.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <fieldset>
          <legend className="text-foreground text-[13px] leading-none font-medium">
            Fields of study
          </legend>
          <p
            id="fieldsOfStudy-hint"
            className="text-muted-foreground mt-1.5 text-[12px] leading-5"
          >
            Choose up to {MAX_FIELDS}. Select the subjects you are most
            interested in.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STUDY_FIELDS.map((field) => {
              return (
                <div key={field} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`field-${field}`}
                    name="fieldsOfStudy"
                    value={field}
                    defaultChecked={defaults.fieldsOfStudy.includes(field)}
                    onChange={(event) =>
                      toggleField(field, event.target.checked)
                    }
                    className="mt-0.5"
                    aria-describedby="fieldsOfStudy-hint"
                  />
                  <Label
                    htmlFor={`field-${field}`}
                    className="text-muted-foreground text-[12.5px] leading-5 font-normal"
                  >
                    {field}
                  </Label>
                </div>
              );
            })}
          </div>
          {tooManyFields || errors.fieldsOfStudy ? (
            <p
              role="alert"
              className="mt-2 text-[12.5px] text-red-600 dark:text-red-400"
            >
              {errors.fieldsOfStudy ??
                `Choose at most ${MAX_FIELDS} fields of study.`}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="englishTest"
            label="English test"
            error={errors.englishTest}
            optional
          >
            <Select
              id="englishTest"
              name="englishTest"
              defaultValue={defaults.englishTest}
              aria-invalid={Boolean(errors.englishTest)}
              aria-describedby={
                errors.englishTest ? "englishTest-error" : undefined
              }
            >
              <option value="">Select test</option>
              {ENGLISH_TESTS.map((test) => (
                <option key={test.value} value={test.value}>
                  {test.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="englishScore"
            label="English score"
            error={errors.englishScore}
            hint="For example: IELTS 6.5 or TOEFL 90."
            optional
          >
            <Input
              id="englishScore"
              name="englishScore"
              defaultValue={defaults.englishScore}
              maxLength={40}
              aria-invalid={Boolean(errors.englishScore)}
              aria-describedby={
                errors.englishScore ? "englishScore-error" : "englishScore-hint"
              }
            />
          </FormField>
        </div>
      </section>

      <section className="surface-card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold">Annual budget</h2>
          <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
            Optional. A rough figure helps filter scholarships and tuition
            ranges. You can change it at any time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <FormField
            id="budgetAmount"
            label="Budget amount"
            error={errors.budgetAmount}
            optional
          >
            <Input
              id="budgetAmount"
              name="budgetAmount"
              inputMode="numeric"
              placeholder="12000"
              defaultValue={defaults.budgetAmount}
              aria-invalid={Boolean(errors.budgetAmount)}
              aria-describedby={
                errors.budgetAmount ? "budgetAmount-error" : undefined
              }
            />
          </FormField>

          <FormField
            id="budgetCurrency"
            label="Currency"
            error={errors.budgetCurrency}
            optional
          >
            <Select
              id="budgetCurrency"
              name="budgetCurrency"
              defaultValue={defaults.budgetCurrency}
              aria-invalid={Boolean(errors.budgetCurrency)}
              aria-describedby={
                errors.budgetCurrency ? "budgetCurrency-error" : undefined
              }
            >
              <option value="">Select currency</option>
              {BUDGET_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      {isMinor ? (
        <section className="surface-card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold">Parent or guardian</h2>
            <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
              Because you are under 18, a guardian must approve your workspace.
              Change these details only if the previous request was not
              received.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="guardianName"
              label="Guardian's name"
              error={errors.guardianName}
            >
              <Input
                id="guardianName"
                name="guardianName"
                defaultValue={defaults.guardianName}
                autoComplete="off"
                aria-invalid={Boolean(errors.guardianName)}
                aria-describedby={
                  errors.guardianName ? "guardianName-error" : undefined
                }
              />
            </FormField>

            <FormField
              id="guardianEmail"
              label="Guardian's email"
              error={errors.guardianEmail}
            >
              <Input
                id="guardianEmail"
                name="guardianEmail"
                type="email"
                inputMode="email"
                defaultValue={defaults.guardianEmail}
                autoComplete="off"
                aria-invalid={Boolean(errors.guardianEmail)}
                aria-describedby={
                  errors.guardianEmail ? "guardianEmail-error" : undefined
                }
              />
            </FormField>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[12px] leading-5">
          Your profile is never shown publicly.
        </p>
        <SubmitButton pendingLabel="Saving profile…" className="sm:w-auto">
          Save profile
        </SubmitButton>
      </div>
    </form>
  );
}
