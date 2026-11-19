"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logError } from "@/lib/observability/logger";

export default function UniversityDiscoveryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("catalog.discovery_failed", error, { digest: error.digest });
  }, [error]);

  return (
    <div role="alert" className="surface-card mx-auto max-w-xl p-6 text-center">
      <h1 className="text-lg font-semibold">
        Universities could not be loaded
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Please try again. Your saved filters and tracker data have not been
        changed.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
