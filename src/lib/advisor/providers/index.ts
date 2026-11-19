import "server-only";

import type { AdvisorConfig } from "@/lib/advisor/config";
import { createAnthropicProvider } from "@/lib/advisor/providers/anthropic";
import { createOpenAiCompatibleProvider } from "@/lib/advisor/providers/openai";
import type { AdvisorChatProvider } from "@/lib/advisor/providers/types";

export function createAdvisorProvider(
  config: AdvisorConfig,
): AdvisorChatProvider {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicProvider(config);
    case "openrouter":
      return createOpenAiCompatibleProvider(config, "OpenRouter");
    case "compatible":
      return createOpenAiCompatibleProvider(config, "compatible endpoint");
    case "openai":
    default:
      return createOpenAiCompatibleProvider(config, "OpenAI");
  }
}

export type {
  AdvisorChatProvider,
  AdvisorProviderRequest,
  AdvisorProviderResponse,
  AdvisorProviderTurn,
  AdvisorToolCall,
  AdvisorToolSpec,
} from "@/lib/advisor/providers/types";
