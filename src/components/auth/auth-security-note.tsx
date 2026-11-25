import { ShieldCheck } from "lucide-react";

export function AuthSecurityNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-muted/40 flex gap-2.5 rounded-xl border p-3">
      <ShieldCheck
        aria-hidden="true"
        className="text-primary mt-0.5 size-4 shrink-0"
      />
      <p className="text-muted-foreground text-[12.5px] leading-5">
        {children}
      </p>
    </div>
  );
}
