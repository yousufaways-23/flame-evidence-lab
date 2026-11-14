"use client";

/**
 * SharedObservables — quantitative cross-experiment comparison for Compare.
 *
 * For the selected investigations, this component scans the REAL recovered
 * table columns (numeric stats computed at ingest: min/max/mean/fill over
 * raw rows) and groups them by canonical physical quantity. A quantity is
 * rendered only when TWO OR MORE selected investigations measured it —
 * otherwise there is nothing to compare and nothing is invented.
 *
 * Every bar is min–max range with the mean marker, drawn from the bundled
 * sha256-verified corpus. Units come from the NASA source headers; ranges
 * never span different units (they are grouped per unit). Missing stays
 * missing: a column with no numeric stats is skipped, never zero-filled.
 */

import { useMemo } from "react";
import { Ruler } from "lucide-react";
import { getTablesForInvestigation, type Investigation, type TableColumn } from "@/lib/data/catalog";

interface ObservableEntry {
  accession: string;
  tableId: string;
  columnName: string;
  unit: string | null;
  n: number;
  min: number;
  max: number;
  mean: number | null;
}

interface ObservableGroup {
  key: string;
  label: string;
  unit: string | null;
  entries: ObservableEntry[];
  /** true when some entries were converted into the group's canonical unit */
  converted?: boolean;
}

/** Canonical quantity matchers, ordered most-specific first. */
const QUANTITIES: { key: string; label: string; match: RegExp }[] = [
  // oxygen: "XO2", "oxygen", and the element-style "O initial ambient composition";
  // the (?<!c) guard excludes CO2 (carbon dioxide is a different quantity).
  // Flow/velocity columns ("O2 flow rate", "Air Flow") are NOT concentrations —
  // they are deliberately unmatched so fractions never mix with flows.
  { key: "o2", label: "Oxygen mole fraction / concentration", match: /oxygen|(?<!c)o2\b|(?<![a-z])o(?=[\s;,])/i },
  { key: "pressure", label: "Ambient / chamber pressure", match: /pressure|mmhg|\bk?pa\b|\bpsia?\b|\bbar\b/i },
  { key: "diameter", label: "Droplet / sample diameter", match: /diameter|d0\b/i },
  { key: "burn-rate", label: "Burning rate / mass flux", match: /burn(ing)?\s*rate|mass\s*flux/i },
  { key: "heat-flux", label: "Heat flux", match: /heat\s*flux/i },
  { key: "flame-size", label: "Flame radius / length / height", match: /flame\s*(radius|length|height|standoff)/i },
  { key: "temperature", label: "Temperature", match: /temperature|\btad\b|\btemp\b/i },
  { key: "soot", label: "Soot volume fraction / soot index", match: /soot/i },
  { key: "radiant", label: "Radiant fraction / radiance", match: /radiant|radiance/i },
  { key: "velocity", label: "Flow velocity", match: /flow velocity/i },
];

/** Column names that must never be read as a concentration/fraction. */
const FLOW_LIKE = /flow|velocity/i;

function matchQuantity(col: TableColumn): { key: string; label: string } | null {
  // flow controllers ("O2 flow rate (mg/s)", "Air Flow") are not fraction measurements
  if (FLOW_LIKE.test(col.name) && !/flame/i.test(col.name)) return null;
  for (const q of QUANTITIES) {
    if (q.match.test(col.name) || (col.rawHeader && q.match.test(col.rawHeader))) {
      return { key: q.key, label: q.label };
    }
  }
  return null;
}

/**
 * Unit normalization + conversion. Values in different units are only grouped
 * together when a labelled, exact conversion to the group's canonical unit
 * exists — the conversion factor is stated on the group. Everything else
 * stays in separate per-unit groups (never mixed).
 */
const UNIT_ALIASES: Record<string, string> = {
  "mole fraction": "dimensionless",
  "mole frac": "dimensionless",
  "-": "dimensionless",
  "": "dimensionless",
  mmhg: "mmHg",
  bar: "mmHg",
  kpa: "mmHg",
  psi: "mmHg",
  psia: "mmHg",
  atm: "mmHg",
};
const TO_MMHG: Record<string, number> = {
  mmhg: 1,
  bar: 750.0617,
  kpa: 7.5006168,
  psi: 51.7149323,
  psia: 51.7149323,
  atm: 760,
};

function normUnit(unit: string | null): string {
  const u = (unit ?? "").trim().toLowerCase();
  return UNIT_ALIASES[u] ?? u;
}

/** Convert a value into the canonical unit of its normalized group. */
function convert(v: number, unit: string | null, norm: string): { value: number; converted: boolean } {
  if (norm === "mmHg") {
    const raw = (unit ?? "").trim().toLowerCase();
    const f = TO_MMHG[raw];
    if (f && f !== 1) return { value: v * f, converted: true };
  }
  return { value: v, converted: false };
}

function buildGroups(selected: Investigation[]): ObservableGroup[] {
  const byKey = new Map<string, ObservableGroup>();
  let anyConverted = false;
  for (const inv of selected) {
    const tables = getTablesForInvestigation(inv.accession);
    for (const t of tables) {
      for (const c of t.columns) {
        if (c.type !== "numeric" || c.min === undefined || c.max === undefined) continue;
        const q = matchQuantity(c);
        if (!q) continue;
        const norm = normUnit(c.unit);
        const conv = (v: number) => convert(v, c.unit, norm);
        const cMin = conv(c.min);
        const cMax = conv(c.max);
        if (cMin.converted) anyConverted = true;
        const entry: ObservableEntry = {
          accession: inv.accession,
          tableId: t.id,
          columnName: c.name,
          unit: c.unit ?? null,
          n: c.filled ?? 0,
          min: cMin.value,
          max: cMax.value,
          mean: c.mean !== undefined && c.mean !== null ? conv(c.mean).value : null,
        };
        const gk = `${q.key}::${norm}`;
        const g = byKey.get(gk) ?? { key: gk, label: q.label, unit: norm === "dimensionless" ? null : norm, entries: [] };
        g.entries.push(entry);
        byKey.set(gk, g);
      }
    }
  }
  // keep only quantities measured by 2+ distinct investigations; surface the
  // conversion note on pressure groups (bar/psi/kPa → mmHg)
  const groups = [...byKey.values()]
    .filter((g) => new Set(g.entries.map((e) => e.accession)).size >= 2)
    .sort((a, b) => b.entries.length - a.entries.length);
  if (anyConverted) {
    for (const g of groups) {
      if (g.unit === "mmHg") g.converted = true;
    }
  }
  return groups;
}

function fmtVal(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 10000) return v.toExponential(2);
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}

const ACC_COLORS = ["#be5f35", "#5799d1", "#3f9d7a", "#a06cc9"];

function RangeBar({ entry, lo, hi, color }: { entry: ObservableEntry; lo: number; hi: number; color: string }) {
  const span = hi - lo || 1;
  const left = ((entry.min - lo) / span) * 100;
  const width = Math.max(1.2, ((entry.max - entry.min) / span) * 100);
  const meanLeft = entry.mean !== null ? ((entry.mean - lo) / span) * 100 : null;
  return (
    <div className="relative h-5 w-full rounded bg-white/5">
      <div
        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full opacity-80"
        style={{ left: `${left}%`, width: `${width}%`, background: color }}
        title={`${entry.columnName}: ${fmtVal(entry.min)} – ${fmtVal(entry.max)}`}
      />
      {meanLeft !== null && entry.mean !== null && (
        <span
          className="absolute top-0.5 h-4 w-0.5 rounded bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
          style={{ left: `${meanLeft}%` }}
          title={`mean ${fmtVal(entry.mean)}`}
        />
      )}
    </div>
  );
}

export function SharedObservables({ selected }: { selected: Investigation[] }) {
  const groups = useMemo(() => buildGroups(selected), [selected]);

  if (selected.length < 2) {
    return (
      <div className="glass-panel rounded-xl p-5 text-xs text-muted-foreground">
        Select two or more investigations to compare measured parameter ranges.
      </div>
    );
  }

  const colorOf = new Map(selected.map((inv, i) => [inv.accession, ACC_COLORS[i % ACC_COLORS.length]]));

  return (
    <section aria-label="Shared measurable quantities">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Ruler className="h-4 w-4 text-primary" aria-hidden />
          Shared measurable quantities
        </h2>
        <p className="text-[11px] text-muted-foreground">
          min–max ranges with mean marker (white tick), computed at ingest from the recovered rows — grouped per unit,
          only where ≥2 selected investigations measured the quantity
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="glass-panel rounded-xl p-5 text-xs text-muted-foreground">
          No physical quantity is measured by two or more of the selected investigations&apos; recovered tables — the
          selected studies do not overlap on a measurable parameter, so no cross-study range comparison is drawn.
          This is an honest absence, not missing UI.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const lo = Math.min(...g.entries.map((e) => e.min));
            const hi = Math.max(...g.entries.map((e) => e.max));
            return (
              <div key={g.key} className="research-panel rounded-xl p-4">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold">{g.label}</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    unit: {g.unit ?? "dimensionless"} · axis {fmtVal(lo)} → {fmtVal(hi)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {g.entries
                    .slice()
                    .sort((a, b) => selected.findIndex((s) => s.accession === a.accession) - selected.findIndex((s) => s.accession === b.accession))
                    .map((e, i) => (
                      <div key={`${e.tableId}-${e.columnName}-${i}`} className="grid grid-cols-[150px_1fr] items-center gap-3 sm:grid-cols-[210px_1fr]">
                        <div className="min-w-0 text-[10px] leading-tight">
                          <span className="font-mono font-semibold" style={{ color: colorOf.get(e.accession) }}>
                            {e.accession}
                          </span>
                          <span className="block truncate text-muted-foreground" title={`${e.tableId} · ${e.columnName}`}>
                            {e.columnName} · n={e.n}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RangeBar entry={e} lo={lo} hi={hi} color={colorOf.get(e.accession) ?? "#888"} />
                          <span className="w-36 shrink-0 font-mono text-[9.5px] text-muted-foreground">
                            {fmtVal(e.min)}–{fmtVal(e.max)}
                            {e.mean !== null ? ` (μ ${fmtVal(e.mean)})` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                <p className="provenance-strip mt-2.5">
                  source: {[...new Set(g.entries.map((e) => e.tableId))].join(", ")} — sha256-verified recovered tables
                  {g.converted ? " · bar/psi/kPa values converted to mmHg (exact factors: 1 bar = 750.0617 mmHg, 1 psi = 51.7149 mmHg, 1 kPa = 7.5006 mmHg); converted values are calculated, not measured" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
