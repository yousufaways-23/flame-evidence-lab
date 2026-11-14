// GET /api/llm-status — boolean-only LLM configuration status for the UI.
// Never exposes the key, the URL's auth header or any credential material.

import { NextResponse } from "next/server";
import { getLLMStatus } from "@/lib/agent/llm";

export const runtime = "nodejs";

export async function GET() {
  const s = getLLMStatus();
  return NextResponse.json({
    configured: s.configured,
    model: s.model,
    // the copilot degrades to deterministic tools when unconfigured — label it honestly
    mode: s.configured ? "live" : "deterministic-fallback",
  });
}
