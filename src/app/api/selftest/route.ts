/**
 * GET /api/selftest — deterministic scientific self-test (release gate M12).
 * Runs the equation registry reference tests, the comparability gate, the
 * fire-safety facility engine and the reduced-physics relations against the
 * canonical corpus. No LLM involved; every assertion is deterministic.
 */
import { NextResponse } from "next/server";
import { runEquationTests, getEquationRegistryCount } from "@/lib/science/equations";
import { auditComparability } from "@/lib/science/comparability";
import { analyzeFacility } from "@/lib/science/firesafety";
import { richardson } from "@/lib/science/physics";
import { getInvestigations } from "@/lib/data/catalog";

export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  // 1 — equation registry
  const eq = runEquationTests();

  // 2 — comparability gate: FLEX (droplet, microgravity) vs SAFFIRE-II (vehicle-scale)
  const invs = getInvestigations();
  const flex = invs.find((i) => i.accession === "PSI-69");
  const saffire = invs.find((i) => i.accession === "PSI-99");
  const gate =
    flex && saffire
      ? auditComparability([flex, saffire])
      : { level: "missing-records", reasons: [], requirements: [], dimensions: [], comparable: false };

  // 3 — facility engine (lunar habitat concept, challenge-documented atmosphere)
  const facility = analyzeFacility({
    stationType: "lunar-habitat",
    gravity: 0.166,
    o2: 0.3,
    pressureKpa: 70.3,
    ventilationCmS: 5,
    compartments: [
      {
        id: "c1",
        name: "Crew quarter",
        lengthM: 3.5,
        widthM: 3.5,
        heightM: 2.4,
        materials: ["paper-cotton", "nomex"],
        ventilationCmS: 5,
        ignitionSources: ["electronics"],
        detection: ["photoelectric"],
        suppression: ["portable-ext"],
      },
    ],
  });

  // 4 — physics relations
  const riEarth = richardson(1, 5);
  const riMicrog = richardson(1e-6, 5);

  const checks = [
    {
      id: "equation-registry",
      label: "Equation registry reference tests",
      pass: eq.failed.length === 0,
      detail: `${getEquationRegistryCount()} equations · ${eq.passed}/${eq.passed + eq.failed.length} tests pass`,
    },
    {
      id: "comparability-gate",
      label: "Comparability gate refuses PSI-69 vs PSI-99 direct comparison",
      pass: gate.level === "not-comparable" || gate.level === "conditional",
      detail: `verdict: ${gate.level}${gate.reasons.length ? ` — ${gate.reasons[0].slice(0, 90)}…` : ""}`,
    },
    {
      id: "facility-engine",
      label: "Fire-safety facility engine (lunar concept)",
      pass: facility.partialGravityCaveat === true && facility.compartments.length === 1 && facility.recommendations.length > 0,
      detail: `pO₂ ${facility.pO2Kpa.toFixed(1)} kPa · regime ${facility.regimeLabel} · top ${facility.compartments[0].total}/100 · ${facility.recommendations.length} recommendations · partial-g caveat emitted`,
    },
    {
      id: "physics-ri",
      label: "Richardson number collapses in microgravity",
      pass: Math.abs(riMicrog) < Math.abs(riEarth) / 1000,
      detail: `Ri(1 g, 5 cm/s) = ${riEarth.toFixed(2)} · Ri(µg) = ${riMicrog.toExponential(2)}`,
    },
  ];

  const allPass = checks.every((c) => c.pass);
  return NextResponse.json(
    {
      ok: allPass,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      checks,
      note: "Deterministic self-test — no LLM, no network. Run before every release checkpoint.",
    },
    { status: allPass ? 200 : 500 },
  );
}
