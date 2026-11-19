import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/15 accent-primary size-4 shrink-0 rounded border",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
