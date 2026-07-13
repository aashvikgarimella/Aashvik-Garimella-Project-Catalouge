/**
 * AI provider configuration. Supports OpenAI, Google Gemini, and/or Anthropic.
 *
 * To enable AI, add ONE or MORE of these to `.env.local` and restart:
 *   GEMINI_API_KEY=AIza...         (uses gemini-3-flash-preview by default)
 *   OPENAI_API_KEY=sk-...          (uses gpt-4o-mini by default)
 *   ANTHROPIC_API_KEY=sk-ant-...   (uses claude-opus-4-8 by default)
 *
 * Whichever key(s) you provide become available. If you provide more than one,
 * choose which runs in Settings → AI assistant (stored per user). Override a
 * model with GEMINI_MODEL / OPENAI_MODEL / ANTHROPIC_MODEL. Keys are read
 * server-side only (no NEXT_PUBLIC_ prefix), so they never reach the browser.
 */

export type AiProvider = "gemini" | "openai" | "anthropic";

export const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

export function getGeminiApiKey(): string | null {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim() || null;
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

/** Providers that have a configured key, in default-precedence order. */
export function getConfiguredProviders(): AiProvider[] {
  const list: AiProvider[] = [];
  if (getGeminiApiKey()) list.push("gemini");
  if (getOpenAiApiKey()) list.push("openai");
  if (getAnthropicApiKey()) list.push("anthropic");
  return list;
}

/** Whether any provider is configured. */
export function isAiConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

/** Resolve the provider to use given the user's preference, else auto-detect. */
export function resolveProvider(pref?: string | null): AiProvider | null {
  const configured = getConfiguredProviders();
  if ((pref === "gemini" || pref === "openai" || pref === "anthropic") && configured.includes(pref)) {
    return pref;
  }
  return configured[0] ?? null;
}

/** Default model id for a provider (env-overridable). */
export function getModelForProvider(provider: AiProvider): string {
  if (provider === "gemini") return process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
  if (provider === "openai") return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8";
}
