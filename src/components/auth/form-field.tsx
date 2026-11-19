import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, control, and message wrapper. Callers pass the control's `id` and set
 * `aria-describedby` to `${id}-error` or `${id}-hint` for screen readers.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  optional = false,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {optional ? (
          <span className="text-muted-foreground text-[11px]">Optional</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[12.5px] leading-5 text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="text-muted-foreground text-[12px] leading-5"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
