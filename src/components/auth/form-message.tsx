import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/actions/state";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <Alert variant={state.status === "error" ? "error" : "success"}>
      <span>{state.message}</span>
    </Alert>
  );
}
