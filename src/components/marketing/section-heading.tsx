import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <div className={cn("eyebrow", align === "center" && "justify-center")}>
        <span aria-hidden="true" className="bg-primary/40 h-px w-5" />
        {eyebrow}
      </div>
      <h2 className="mt-4 text-[1.85rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-[2.7rem]">
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground mt-4 max-w-2xl text-[15px] leading-7 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
