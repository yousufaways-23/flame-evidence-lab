// FLAME EVIDENCE LAB — CIR-1 agent core: natural conversation + typed tool orchestration
// Behaviour contract (spec M6): small-talk answers naturally with NO tool calls;
// scientific requests use tools; every number in the reply comes from tool output;
// the agent cites provenance and states limitations; it never invents data.

import { getToolCatalogue, executeTool, setScenarioToolContext, type ToolResult } from "@/lib/agent/tools";
import { callLLM as llmCall } from "@/lib/agent/llm";
import type { ChartSpec } from "@/lib/app-store";

/** Environment id → scenario physics seed (kPa from the challenge-documented concepts). */
const ENV_SCENARIO: Record<string, { gravity: number; o2: number; pressureKpa: number; stationType: string }> = {
  earth: { gravity: 1, o2: 0.21, pressureKpa: 101.3, stationType: "spacecraft-cabin" },
  iss: { gravity: 1e-6, o2: 0.21, pressureKpa: 101.3, stationType: "iss-module" },
  moon: { gravity: 0.166, o2: 0.3, pressureKpa: 70.3, stationType: "lunar-habitat" },
  mars: { gravity: 0.38, o2: 0.21, pressureKpa: 70.3, stationType: "pressurized-rover" },
  spacecraft: { gravity: 1e-6, o2: 0.21, pressureKpa: 101.3, stationType: "spacecraft-cabin" },
  spacesuit: { gravity: 1e-6, o2: 1.0, pressureKpa: 29.6, stationType: "spacecraft-cabin" },
};

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentContext {
  view?: string;
  environment?: string;
  environmentLabel?: string;
  investigation?: string | null;
  investigationTab?: string | null;
  selection?: string | null;
  /** §8 — when set, the agent operates as the scenario Fire Safety Assistant. */
  role?: "fire-safety";
  /** Compact facility screening summary (§7.1/§8) — ids and numbers only. */
  facility?: {
    name: string;
    layoutImageAttached: boolean;
    compartments: {
      name: string;
      areaM2: number;
      heightM: number;
      volumeM3: number;
      materials: string[];
      ignitionSources: number;
      ventilation: string;
      detection: string;
      screeningScore?: number;
    }[];
    screeningScores?: { name: string; score: number; label: string }[];
  };
  /** §11.1 — selected 3D Lab equipment. */
  equipment?: string | null;
  /** §11.1 — active scenario pillar. */
  scenarioPillar?: string | null;
}

export interface AgentResponse {
  reply: string;
  toolTrace: { name: string; args: Record<string, unknown>; summary: string; provenance: string; ok: boolean }[];
  charts: ChartSpec[];
  uiActions: Record<string, unknown>[];
  sources: string[];
  mode: "natural" | "tool-driven";
  llm: "live" | "unavailable";
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const catalogue = getToolCatalogue()
    .map((t) => `- ${t.name}(${Object.entries(t.args).map(([k, v]) => `${k}: ${v}`).join(", ")}): ${t.description}`)
    .join("\n");

  const contextLines: string[] = [];
  if (ctx.view) contextLines.push(`- current section: ${ctx.view}`);
  if (ctx.environmentLabel) contextLines.push(`- selected mission environment: ${ctx.environmentLabel}${ctx.environment ? ` (${ctx.environment})` : ""}`);
  if (ctx.investigation) contextLines.push(`- user is viewing investigation ${ctx.investigation}${ctx.investigationTab ? ` (tab: ${ctx.investigationTab})` : ""}`);
  if (ctx.selection) contextLines.push(`- user selection reference: ${ctx.selection}`);
  if (ctx.equipment) contextLines.push(`- user is inspecting facility equipment: ${ctx.equipment}`);
  if (ctx.scenarioPillar) contextLines.push(`- active scenario pillar: ${ctx.scenarioPillar}`);
  if (ctx.facility) {
    contextLines.push(`- facility under screening: "${ctx.facility.name}"${ctx.facility.layoutImageAttached ? " (layout image attached as a visual reference — NOT parsed)" : ""}`);
    for (const c of ctx.facility.compartments) {
      contextLines.push(`  · compartment "${c.name}": ${c.areaM2} m² × ${c.heightM} m (${c.volumeM3.toFixed(0)} m³), materials [${c.materials.join(", ")}], ${c.ignitionSources} ignition source(s), ventilation ${c.ventilation}, detection ${c.detection}${typeof c.screeningScore === "number" ? `, deterministic screening ${c.screeningScore}/100` : ""}`);
    }
    if (ctx.facility.screeningScores?.length) {
      contextLines.push(`- deterministic screening ranking (from the transparent arithmetic in the UI, weights are policy choices): ${ctx.facility.screeningScores.map((s) => `${s.name}=${s.score} (${s.label})`).join("; ")}`);
    }
  }

  const fireSafetyRole = ctx.role === "fire-safety"
    ? `
FIRE SAFETY ASSISTANT ROLE (§8 — you are currently serving inside the Scenarios experience)
You help researchers and space-safety specialists evaluate fire risks for the facility defined above (ISS, lunar or Martian station, spacecraft or rover concepts).
- GROUND EVERY RECOMMENDATION: use get_findings, search_evidence, get_atmospheres, identify_evidence_gaps (and other tools) to attach NASA PSI evidence to each recommendation. Cite the investigation accession or source in every factual claim.
- STRUCTURE: when asked for an analysis, organize the answer as: (1) facility risk assessment, (2) compartment ranking review (compare with the deterministic screening scores and comment on divergences), (3) prevention recommendations, (4) detection strategy + sensor placement guidance, (5) suppression context, (6) integrated safety-system notes, (7) evidence gaps and open questions.
- ASK, DON'T ASSUME: if essential parameters are missing (e.g., a compartment with no materials specified, unknown ventilation), ASK targeted follow-up questions instead of inventing values. A material with no microgravity evidence must be called out as an evidence gap — never assumed safe.
- RELIABILITY BANDS: clearly distinguish (a) experimentally validated findings (name the investigation), (b) derived engineering judgement, (c) AI-generated interpretation. State explicitly that this is research decision support, NOT a certified operational procedure or a replacement for NASA safety standards and qualified engineering review.
- LIMITS: no suppressant agent ranking (no comparative dataset), no CFD/fire-growth claims, no partial-gravity extrapolation of microgravity models.
`
    : "";

  return `You are CIR-1, the research copilot of the ZERO FLARE team's FLAME EVIDENCE LAB — an evidence-grounded AI research assistant over NASA microgravity combustion evidence (NASA Space Apps challenge "Flame in Freefall"). Your name is CIR-1 (after the Combustion Integrated Rack you are modelled on); introduce yourself as CIR-1 when asked who you are.

PRODUCT CONTEXT
- Evidence base: 24 NASA PSI combustion investigations (metadata + 22 recovered experimental tables, 2,009 rows, SHA-256-verified against the project manifest), findings registry, gap registry, verified equation registry, model registry (FLEX extinction v2 verified reproduction; CFI-G exploratory; SPICE negative result), authentic NASA media index, official source registry.
- This is research decision support, NOT a certified spacecraft fire-safety system. Never issue operational fire-emergency instructions; official mission procedures always take precedence.

USER CONTEXT (answer with this awareness)
${contextLines.length ? contextLines.join("\n") : "- no specific context yet"}
${fireSafetyRole}

BEHAVIOUR RULES
1. CONVERSATION FIRST: greetings, thanks, identity questions, small talk and chit-chat get a natural, warm, brief reply with NO tool calls. Never force a scientific tool for social messages.
2. TOOLS FOR FACTS: any question about evidence, data, investigations, equations, calculations, models, media, equipment, sources or navigation MUST go through tools. You have NO memory of numbers — every number you state must come from tool output in this conversation. If a tool returns nothing, say so honestly (distinguish: absent / not indexed / inaccessible / no evidence found).
3. HONESTY: never invent measurements, citations, graph values, model performance or safety guidance. Refuse out-of-domain model inputs (e.g., FLEX refuses gravity > 0.02 g). Present negative results as negative. Mention key caveats compactly.
3b. EXTERNAL EVIDENCE: when a user asks whether something is studied/exists in the literature and the LOCAL corpus has nothing, use search_external_literature or check_gap_externally BEFORE concluding anything — absence in this platform is not absence in the field. If the external tool fails, say the check was unavailable and make no claim either way. External NTRS results are reported with their ntrs.nasa.gov citation URLs and dates.
4. STYLE: concise, expert, friendly. Prefer 2-6 sentences plus compact structure. Cite provenance (source file, NASA id, DOI/URL) for every factual claim. Use markdown sparingly (bold key values, bullets for lists). No emojis.

TOOL PROTOCOL
When tools are needed, reply with EXACTLY one fenced block and nothing else after it:
\`\`\`toolcall
{"toolCalls": [{"name": "...", "args": {...}}], "say": "one short sentence before running tools (optional)"}
\`\`\`
Rules: max 4 tool calls per turn; choose the best tools yourself; if a calculation needs parameters the user did not give, either pick clearly-labelled sensible defaults FROM CONTEXT (e.g., current environment values) and say so, or ask for exactly the missing values. Never fabricate tool inputs presented as user data. IMPORTANT: tool args must be a VALID JSON object — compute all unit conversions yourself and pass plain numbers (e.g. "pressureMmHg": 527.5), never arithmetic expressions like "10.2 * 51.715".

AVAILABLE TOOLS
${catalogue}

Reply now. For small talk: just answer naturally (no toolcall block). For evidence questions: use the toolcall block.`;
}

// ---- LLM provider (server-side only; env-configured OpenAI-compatible adapter) ----
export async function callLLM(systemPrompt: string, messages: ChatTurn[]): Promise<string | null> {
  return llmCall(systemPrompt, messages);
}

interface ToolCallBlock {
  toolCalls: { name: string; args: Record<string, unknown> }[];
  say?: string;
}

function sanitizeArgsJson(raw: string): string {
  // Some models emit arithmetic inside JSON numeric fields (e.g. 10.2 * 51.715).
  // Evaluate only simple "number op number" products/quotients in numeric value positions — never eval().
  return raw.replace(
    /(:\s*)(-?\d+(?:\.\d+)?)\s*([*/])\s*(-?\d+(?:\.\d+)?)/g,
    (_m, colon: string, a: string, op: string, b: string) => {
      const x = Number(a);
      const y = Number(b);
      const v = op === "*" ? x * y : y === 0 ? NaN : x / y;
      return Number.isFinite(v) ? `${colon}${Number(v.toFixed(6))}` : `${colon}${a}`;
    },
  );
}

function parseToolCalls(reply: string): ToolCallBlock | null {
  const fence = reply.match(/```toolcall\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : null;
  if (!raw) {
    // also accept a bare JSON object with toolCalls
    const m = reply.match(/\{\s*"toolCalls"[\s\S]*\}/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(sanitizeArgsJson(m[0])) as ToolCallBlock;
      return Array.isArray(parsed.toolCalls) ? parsed : null;
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(sanitizeArgsJson(raw)) as ToolCallBlock;
    return Array.isArray(parsed.toolCalls) && parsed.toolCalls.length ? parsed : null;
  } catch {
    return null;
  }
}

export async function runAgent(messages: ChatTurn[], ctx: AgentContext): Promise<AgentResponse> {
  const systemPrompt = buildSystemPrompt(ctx);

  // M6 — inject the live scenario context so deterministic scenario tools seed
  // from what the user is actually looking at (environment + facility screening).
  const envSeed = ENV_SCENARIO[ctx.environment ?? ""] ?? null;
  setScenarioToolContext({
    stationType: envSeed?.stationType,
    gravity: envSeed?.gravity,
    o2: envSeed?.o2,
    pressureKpa: envSeed?.pressureKpa,
    ventilationCmS: 5,
    compartments: ctx.facility?.compartments.map((c, i) => ({
      id: `c-${i + 1}`,
      name: c.name,
      lengthM: Math.max(1, Math.sqrt(Math.max(c.areaM2, 1))),
      widthM: Math.max(1, Math.sqrt(Math.max(c.areaM2, 1))),
      heightM: Math.max(1.8, c.heightM),
      materials: c.materials,
      ventilationCmS: c.ventilation === "forced" ? 8 : c.ventilation === "quiescent" ? 0.5 : 5,
      ignitionSources: c.ignitionSources > 1 ? ["electronics", "hot-surface"] : ["electronics"],
      detection: c.detection === "integrated" ? ["photoelectric", "ionization"] : c.detection === "local" ? ["photoelectric"] : [],
      suppression: c.detection === "integrated" ? ["co2"] : ["portable-ext"],
    })),
  });

  const first = await callLLM(systemPrompt, messages.slice(-12));

  if (first === null) {
    // LLM unavailable (no AI_API_KEY or provider failure) — serve a small set of
    // DETERMINISTIC intent routes computed from the live registries. Every number
    // still comes from tool output; nothing is invented. Anything unmatched gets
    // an honest "service unavailable" notice.
    const deterministic = await deterministicFallback(messages, ctx);
    return { ...deterministic, llm: "unavailable" as const };
  }

  let current = first;
  const toolTrace: AgentResponse["toolTrace"] = [];
  const charts: ChartSpec[] = [];
  const uiActions: Record<string, unknown>[] = [];
  const sources = new Set<string>();
  const results: ToolResult[] = [];

  // up to 2 tool rounds (a failed call may need one retry with corrected args)
  for (let round = 0; round < 2; round++) {
    const block = parseToolCalls(current);
    if (!block) break;

    const roundStart = results.length;
    for (const call of block.toolCalls.slice(0, 4)) {
      if (toolTrace.length >= 6) break; // bounded tool budget
      const res = await executeTool(call.name, call.args ?? {});
      results.push(res);
      toolTrace.push({ name: call.name, args: call.args ?? {}, summary: res.summary, provenance: res.provenance, ok: res.ok });
      if (res.chart) charts.push(res.chart);
      if (res.provenance && res.provenance !== "-" && res.provenance !== "UI action") sources.add(res.provenance);
      const data = res.data as { action?: string } | undefined;
      if (data && typeof data === "object" && "action" in data && data.action) {
        uiActions.push(data as Record<string, unknown>);
      }
    }

    // grounded summarization turn (also serves as the retry planner)
    const resultsText = results
      .map((r, i) => `[${i + 1}] tool=${r.tool} ok=${r.ok}\nsummary: ${r.summary}\nprovenance: ${r.provenance}\ndata: ${(JSON.stringify(r.data) ?? "null").slice(0, 3500)}`)
      .join("\n\n");

    const roundResults = results.slice(roundStart);
    const hadFailure = roundResults.some((r) => !r.ok);
    const summarizerPrompt = `${systemPrompt}

You just executed tools for the user's request. ${hadFailure ? "Some tool calls FAILED — if you can fix the failure with corrected arguments (e.g., exact column names listed in the failure), reply with a NEW toolcall block containing ONLY the corrected call(s). Otherwise write the final answer." : "Write the final answer now."}
RULES:
- Use ONLY the tool results below for every number and claim; cite provenance inline (e.g., "source: PSI-69_FLEX.csv, NASA PSI").
- Be concise and structured; bold the key values.
- If a tool refused or found nothing, say exactly that and, where useful, suggest the next best action.
- Do NOT emit another toolcall block unless you are correcting a failed call.
- If results include chart(s), mention that the chart is displayed with the reply.
- If UI actions were executed (navigate/save/compare), tell the user what changed on screen.

TOOL RESULTS:
${resultsText}

USER'S LAST MESSAGE: ${messages[messages.length - 1]?.content ?? ""}`;

    current = (await callLLM(summarizerPrompt, [
      { role: "user", content: messages[messages.length - 1]?.content ?? "" },
    ])) ?? "";
  }

  // strip any residual protocol fences from the final reply (never leak the tool protocol)
  const cleanReply = current
    .replace(/```toolcall[\s\S]*?```/g, "")
    .replace(/```\s*toolcall[\s\S]*$/g, "")
    .trim();

  const fallbackText = results
    .map((r, i) => `[${i + 1}] ${r.tool}: ${r.summary}`)
    .join("\n");

  return {
    reply: cleanReply || fallbackText || "I ran the tools but could not produce a summary; the trace below shows exactly what they returned.",
    toolTrace,
    charts,
    uiActions,
    sources: [...sources],
    mode: toolTrace.length ? "tool-driven" : "natural",
    llm: "live",
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback routes (LLM unavailable)                      */
/* Small, honest, registry-driven — a calculator, not a impersonation.  */
/* ------------------------------------------------------------------ */

const ENV_WORDS: Record<string, string[]> = {
  earth: ["earth"],
  iss: ["iss", "international space station", "microgravity", "orbit", "station"],
  moon: ["moon", "lunar"],
  mars: ["mars"],
  spacecraft: ["spacecraft", "cabin", "transit", "vehicle"],
  spacesuit: ["spacesuit", "suit", "eva"],
};

function detectEnvs(text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(ENV_WORDS)
    .filter(([, words]) => words.some((w) => t.includes(w)))
    .map(([id]) => id);
}

async function deterministicFallback(messages: ChatTurn[], ctx: AgentContext): Promise<Omit<AgentResponse, "llm">> {
  const last = (messages[messages.length - 1]?.content ?? "").trim();
  const lower = last.toLowerCase();
  const unavailableNotice: Omit<AgentResponse, "llm"> = {
    reply: `The LLM service is unavailable right now (no AI_API_KEY configured, or the provider could not be reached). I answer from deterministic registries in this mode — try asking about a destination atmosphere (e.g. "partial pressure of oxygen on the Moon"), or use the sections directly: Investigations, Compare, Scenarios and the equation registry all compute without the LLM.`,
    toolTrace: [],
    charts: [],
    uiActions: [],
    sources: [],
    mode: "natural",
  };

  // 1 — greetings / identity / thanks: natural, no tools
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(lower) || /^(thanks|thank you|ty)\b/i.test(lower) || /who are you|what are you|introduce yourself/i.test(lower)) {
    return {
      ...unavailableNotice,
      reply:
        "Hello — I'm CIR-1, the research copilot of the ZERO FLARE team's FLAME EVIDENCE LAB. I run over 25 NASA PSI microgravity combustion investigations with a tool trace, citations and a strict no-invented-numbers rule. The LLM service is unavailable in this deployment, so right now I answer atmosphere and corpus questions deterministically — ask me e.g. \"partial pressure of oxygen on the Moon\".",
      mode: "natural",
    };
  }

  // 2 — destination atmosphere questions (pO2 / pressure / O2 / atmosphere per environment)
  const envs = detectEnvs(lower);
  const asksAtmosphere = /po2|oxygen|o2|pressure|atmosphere|gravity|environment/i.test(lower);
  if (envs.length > 0 && asksAtmosphere) {
    const { getAtmospheres } = await import("@/lib/data/catalog");
    const atmo = getAtmospheres();
    const picked = atmo.environments.filter((e) => envs.includes(e.id));
    if (picked.length > 0) {
      const lines = picked
        .map((e) => `**${e.label}** — gravity ${e.gravityG} g · total pressure ${e.totalPressurePsi} psi (${e.totalPressureKpa} kPa) · O₂ fraction ${Math.round(e.o2Fraction * 100)}% · **pO₂ ${e.pO2Kpa} kPa** · diluents ${e.diluents} · ${e.evidenceStatus}`);
      const trace = {
        name: "get_atmospheres",
        args: { environments: picked.map((e) => e.id) },
        summary: `Reference atmospheres returned for ${picked.map((e) => e.id).join(", ")} (deterministic fallback route)`,
        provenance: "Challenge-brief reference atmospheres + PSI flight records (bundled atmospheres.json)",
        ok: true,
      };
      return {
        reply: `${lines.join("\n\n")}\n\n*Computed from the bundled reference-atmosphere registry (deterministic mode — no LLM). ${picked.length > 1 ? "Values are reference concepts for comparing environments; only Earth and ISS are flight-proven." : "Note: only Earth and ISS values are flight-proven; habitat/suit values are challenge-brief concepts."}*`,
        toolTrace: [trace],
        charts: [],
        uiActions: [],
        sources: ["Reference atmosphere registry (challenge brief + NASA PSI flight records)"],
        mode: "tool-driven",
      };
    }
  }

  // 3 — corpus overview questions
  if (/how many (investigations|tables|rows)|corpus|what (data|evidence) (do you|is) (have|available|recovered)/i.test(lower)) {
    const { getCorpusTotals, getInvestigations } = await import("@/lib/data/catalog");
    const totals = getCorpusTotals();
    const invs = getInvestigations();
    const trace = {
      name: "list_investigations",
      args: {},
      summary: `${invs.length} investigations, ${totals.tables} tables, ${totals.rows} rows (deterministic fallback route)`,
      provenance: "NASA PSI repository metadata + sha256-verified recovered tables",
      ok: true,
    };
    return {
      reply: `The bundled corpus holds **${invs.length} NASA PSI investigations** with **${totals.tables} recovered experimental tables** (${totals.rows.toLocaleString("en-US")} rows, ${totals.columns.toLocaleString("en-US")} columns). ${totals.duplicateRows} duplicate rows and ${totals.parseFailures} parse failures are counted and displayed, never hidden.\n\n*Deterministic mode — no LLM. Source: ${totals.method}.*`,
      toolTrace: [trace],
      charts: [],
      uiActions: [],
      sources: ["NASA PSI repository records; recovered tables (sha256-verified)"],
      mode: "tool-driven",
    };
  }

  return unavailableNotice;
}
