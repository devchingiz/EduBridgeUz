import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "border-input bg-card text-foreground flex h-10 w-full min-w-0 appearance-none rounded-lg border px-3 py-2 pr-9 text-sm shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-3",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { Select };
