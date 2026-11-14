// FLAME EVIDENCE LAB — LLM adapter (server-side only)
// Provider-agnostic OpenAI-compatible chat-completions client driven entirely
// by environment configuration. The API key is NEVER read on the client, never
// logged and never returned by any route — only boolean status is exposed.
//
// Environment variables (set as GitHub Secret → Cloudflare Worker secret):
//   AI_API_KEY   — API key for the chat-completions provider (required for live LLM)
//   AI_BASE_URL  — OpenAI-compatible base URL (default: https://api.openai.com/v1)
//   AI_MODEL     — model id (default: gpt-4o-mini)
//
// When AI_API_KEY is absent the copilot falls back to its deterministic mode
// (the UI labels this honestly) — no key is bundled, hardcoded or proxied.

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 55_000;

export interface LLMStatus {
  configured: boolean;
  baseUrl: string;
  model: string;
  /** never includes any key material — presence only */
  keyPresent: boolean;
}

export function getLLMStatus(): LLMStatus {
  const key = process.env.AI_API_KEY;
  return {
    configured: Boolean(key && key.trim()),
    baseUrl: (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.AI_MODEL ?? DEFAULT_MODEL,
    keyPresent: Boolean(key && key.trim()),
  };
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

/** Single chat completion. Returns null on any failure (caller degrades gracefully). */
export async function callLLM(systemPrompt: string, messages: LLMMessage[]): Promise<string | null> {
  const status = getLLMStatus();
  if (!status.configured) {
    console.error("[llm] AI_API_KEY is not configured — running in deterministic fallback mode");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${status.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: status.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[llm] provider ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch (err) {
    console.error("[llm] request failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
