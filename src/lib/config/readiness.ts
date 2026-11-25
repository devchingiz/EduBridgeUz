import "server-only";

import { getAdvisorConfig } from "@/lib/advisor/config";
import {
  getEmailConfig,
  getGoogleOAuthConfig,
  isProduction,
  productionConfigurationIssues,
} from "@/lib/env";
import { validateMalwareScannerConfig } from "@/lib/workspace/malware-scanner";
import { getPrivateObjectStorage } from "@/lib/workspace/object-storage";

/**
 * Presence checks alone can pass while a driver is set to a development-only
 * implementation. Each semantic check calls the same getter used by the
 * feature, so readiness can never be healthier than the running application.
 */
export function productionReadinessIssues(): string[] {
  // Local development and tests do not provision production services. The
  // semantic checks below are meaningful only where those services are required.
  if (!isProduction()) return [];

  const issues = productionConfigurationIssues();

  function check(name: string, validate: () => unknown): void {
    try {
      validate();
    } catch {
      issues.push(name);
    }
  }

  check("EMAIL_CONFIG", getEmailConfig);
  check("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET", getGoogleOAuthConfig);
  check("STORAGE_DRIVER", getPrivateObjectStorage);
  check(
    "MALWARE_SCANNER_DRIVER/MALWARE_SCANNER_HOST",
    validateMalwareScannerConfig,
  );
  check("AI_CONFIG", getAdvisorConfig);

  return [...new Set(issues)];
}
