import { SectionLink } from "@/components/layout/section-link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.5 24.5V17.25C8.5 13.52 11.52 10.5 15.25 10.5H16.75C20.48 10.5 23.5 13.52 23.5 17.25V24.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M6 24.5H26"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M16 10.5V24.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M11.75 24.5V17.5M20.25 24.5V17.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <SectionLink
      href="/#top"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md outline-none",
        className,
      )}
      aria-label="EduBridge home"
    >
      <LogoMark />
      {showWordmark ? (
        <span className="text-[17px] font-semibold tracking-[-0.02em]">
          Edu<span className="text-primary">Bridge</span>
        </span>
      ) : null}
    </SectionLink>
  );
}
