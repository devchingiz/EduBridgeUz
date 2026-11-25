export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      className="text-muted-foreground flex items-center gap-3 text-[11px] font-medium tracking-wide uppercase"
    >
      <span className="bg-border h-px flex-1" />
      <span>{label}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
