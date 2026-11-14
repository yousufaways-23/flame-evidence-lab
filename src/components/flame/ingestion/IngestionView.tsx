"use client";

// FLAME EVIDENCE LAB — Data & Sources: the evidence supply chain (read-only).
// Recovery ledger (SHA-256-verified), recorded historical batches (honest
// status), curated source figures, source registry and the verified NASA
// media catalogue. Nothing absent is displayed as present; the platform is a
// static, deployment-safe read surface — ingestion happens at build time, not
// through a server write path.

import { useMemo, useState } from "react";
import {
  Database, TriangleAlert, CheckCircle2, ExternalLink, Search,
  Files, ShieldCheck, ChevronDown,
} from "lucide-react";
import {
  getCorpusTotals, getTables, getSources, getMedia,
  type DataTable, type SourceRecord,
} from "@/lib/data/catalog";
import figuresDoc from "@/data/generated/figures.json";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// recorded reconciliation facts (fixed historical ledger, M0 report)
// ---------------------------------------------------------------------------

// The 3 tables recovered beyond the 19-file project manifest (recorded in the
// fetch ledger data/ingest/psi_fetch_ledger.json and the M0 reconciliation).
const ADDITIONAL_TABLE_IDS = new Set([
  "PSI-142_PSI-142_Experimental_table_Data_Summary_Table",
  "PSI-47_PSI-47_Experimental_table_DAFT",
  "PSI-98_PSI-98_Experimental_table_SAFFIRE-1",
]);

interface HistoricalBatch { id: string; files: number; note: string }

const HISTORICAL_BATCHES: HistoricalBatch[] = [
  { id: "B-20261109-001", files: 110, note: "initial repository ingest (recorded)" },
  { id: "B-20261109-002", files: 148, note: "second upload batch (recorded)" },
  { id: "B-20261109-003", files: 140, note: "third upload batch (recorded)" },
  { id: "B-20261109-004", files: 42, note: "final upload batch (recorded)" },
];

const HISTORICAL_CUMULATIVE: { label: string; value: string }[] = [
  { label: "files", value: "440" },
  { label: "documents", value: "317" },
  { label: "pages", value: "9,086" },
  { label: "tables", value: "635" },
  { label: "equation candidates", value: "1,220" },
  { label: "figures", value: "3,573" },
  { label: "media assets", value: "2,393" },
  { label: "entities", value: "109" },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fmtBytes(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} kB`;
  return `${b} B`;
}

// ---------------------------------------------------------------------------
// source registry
// ---------------------------------------------------------------------------

export function SourceRegistry() {
  const sources = useMemo(() => getSources(), []);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return sources;
    return sources.filter((s) =>
      `${s.title} ${s.url} ${s.category} ${s.authority} ${s.use}`.toLowerCase().includes(query),
    );
  }, [sources, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, SourceRecord[]>();
    for (const s of filtered) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <section aria-label="Source registry" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Source registry — {sources.length} registered sources</h3>
        <p className="text-[11px] text-muted-foreground">
          External fetching follows SSRF/allowlist policy; NTRS/Images API connectors are registered sources.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter sources by title, category, authority or use…"
          aria-label="Filter source registry"
          className="h-8 text-xs"
        />
      </div>
      <div className="grid max-h-[420px] gap-3 overflow-y-auto data-scroll pr-1 lg:grid-cols-2">
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">No source matches this filter.</p>
        ) : (
          grouped.map(([category, items]) => (
            <div key={category} className="glass-panel rounded-lg p-3">
              <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--emission)]" aria-hidden />
                {category.replace(/_/g, " ")}
                <span className="font-mono text-[10px] normal-case">({items.length})</span>
              </h4>
              <ul className="mt-2 space-y-2">
                {items.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1 text-xs font-medium leading-snug hover:text-primary hover:underline"
                    >
                      <span className="min-w-0">{s.title}</span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    </a>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] leading-snug text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{s.authority}</Badge>
                      {s.use}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// curated source figures (static assets, build-time curated)
// ---------------------------------------------------------------------------

function CuratedFigures() {
  const fig = figuresDoc as {
    generatedAt: string;
    note: string;
    totalCurated: number;
    totalAvailable: number;
    byInvestigation: { accession: string; count: number; sourceFile: string }[];
  };

  return (
    <section aria-label="Curated source figures" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Curated source figures — {fig.totalCurated} bundled assets</h3>
        <p className="text-[11px] text-muted-foreground">
          {fig.totalAvailable} figures were extracted with provenance at ingest time; the curated, non-duplicative
          subset ships as static assets under /figures and renders inside each investigation&apos;s Media tab with
          source-document captions.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fig.byInvestigation
          .filter((x) => x.count > 0)
          .map((x) => (
            <div key={x.accession} className="glass-panel flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <span className="font-mono text-xs text-primary">{x.accession}</span>
                <p className="truncate text-[10px] text-muted-foreground" title={x.sourceFile}>{x.sourceFile}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{x.count} figures</Badge>
            </div>
          ))}
        {fig.byInvestigation.every((x) => x.count === 0) && (
          <p className="text-xs text-muted-foreground">No curated figures registered.</p>
        )}
      </div>
      <p className="provenance-strip">{fig.note}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// media catalogue (verified NASA Images API records only)
// ---------------------------------------------------------------------------

export function MediaCatalogue() {
  const media = useMemo(() => getMedia(), []);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? media : media.slice(0, 8);

  return (
    <section aria-label="Media catalogue" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Media catalogue — {media.length} verified records</h3>
        <p className="text-[11px] text-muted-foreground">
          Provenance: NASA Images and Video Library (images.nasa.gov), credit NASA. Only verified-available media is
          displayed — the 2,393 historical batch binaries are not (see the honesty note above).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((m) => (
          <figure key={m.nasa_id} className="glass-panel overflow-hidden rounded-lg">
            <img
              src={m.thumb}
              alt={m.title}
              loading="lazy"
              className="h-32 w-full object-cover"
            />
            <figcaption className="p-2.5">
              <p className="line-clamp-2 text-[11px] font-medium leading-snug">{m.title}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {m.nasa_id} · {m.center} · credit NASA
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
      {media.length > 8 ? (
        <Button variant="outline" size="sm" className="h-8 w-fit text-xs" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? "Show compact view" : `Show all ${media.length} records`}
          <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} aria-hidden />
        </Button>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// main view
// ---------------------------------------------------------------------------

export function IngestionView() {
  const totals = useMemo(() => getCorpusTotals(), []);
  const tables = useMemo(() => getTables(), []);
  const manifestCount = tables.filter((t) => !ADDITIONAL_TABLE_IDS.has(t.id)).length;
  const ledgerCount = tables.length - manifestCount;

  const totalStrip: { label: string; value: string }[] = [
    { label: "tables", value: String(totals.tables ?? tables.length) },
    { label: "rows", value: (totals.rows ?? 0).toLocaleString() },
    { label: "columns", value: String(totals.columns ?? 0) },
    { label: "duplicate rows", value: String(totals.duplicateRows ?? 0) },
    { label: "parse failures", value: (totals.parseFailures ?? 0).toLocaleString() },
  ];

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          <span className="ember-gradient-text">Data &amp; Sources</span> — evidence supply chain
        </h1>
        <div className="glass-panel flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg px-4 py-3">
          <Database className="h-4 w-4 text-primary" aria-hidden />
          {totalStrip.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="font-mono text-sm font-semibold">{s.value}</p>
            </div>
          ))}
          <p className="ml-auto max-w-md text-[10px] leading-snug text-muted-foreground">
            method: {String(totals.method ?? "—")} · generated {String(totals.generatedAt ?? "—")}
          </p>
        </div>
      </header>

      {/* ---- recovery ledger (current, verified) ---- */}
      <section aria-label="Recovery ledger" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Recovery ledger — verified data assets</h3>
          <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
            Recovered directly from the NASA PSI public download endpoint; 19/19 tables SHA-256-identical to the project
            manifest{ledgerCount > 0 ? ` (+${ledgerCount} additional tables recorded in the fetch ledger)` : ""}.
          </p>
        </div>
        <div className="research-panel max-h-[420px] overflow-auto rounded-lg data-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[color:var(--research)]">
              <TableRow>
                <TableHead className="text-[10px]">file</TableHead>
                <TableHead className="text-[10px]">investigation</TableHead>
                <TableHead className="text-[10px] text-right">rows</TableHead>
                <TableHead className="text-[10px] text-right">cols</TableHead>
                <TableHead className="text-[10px] text-right">duplicates</TableHead>
                <TableHead className="text-[10px] text-right">bytes</TableHead>
                <TableHead className="text-[10px]">sha256</TableHead>
                <TableHead className="text-[10px]">verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((t: DataTable) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-[260px] truncate py-1.5 font-mono text-[11px]" title={t.file}>
                    {t.file}
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-[11px] text-primary">{t.investigation}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-[11px]">{t.rowCount}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-[11px]">{t.columnCount}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-[11px]">{t.duplicateRows}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-[11px]">{fmtBytes(t.bytes)}</TableCell>
                  <TableCell className="py-1.5 font-mono text-[11px] text-muted-foreground" title={t.sha256}>
                    {t.sha256.slice(0, 12)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {ADDITIONAL_TABLE_IDS.has(t.id) ? (
                      <Badge variant="outline" className="text-[10px] text-[color:var(--emission)]">+ fetch ledger</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[10px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> manifest 19/19
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="provenance-strip">
          Hashes recomputed at build time from data/raw (sha256-verified against the project manifest). Missing values
          in these tables stay missing — they are never zero-filled.
        </p>
      </section>

      <Separator className="bg-border/60" />

      {/* ---- historical batches: RECORDED LEDGER, clearly labelled ---- */}
      <section aria-label="Historical ingestion batches" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Historical ingestion batches — recorded ledger (prior repository)</h3>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            These numbers are the recorded historical ingestion ledger of the prior repository build. They describe
            past uploads — they are NOT the current state of this deployment.
          </p>
          <div className="research-panel overflow-hidden rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">batch</TableHead>
                  <TableHead className="text-[10px] text-right">files</TableHead>
                  <TableHead className="text-[10px]">note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HISTORICAL_BATCHES.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="py-1.5 font-mono text-[11px]">{b.id}</TableCell>
                    <TableCell className="py-1.5 text-right font-mono text-[11px]">{b.files}</TableCell>
                    <TableCell className="py-1.5 text-[11px] text-muted-foreground">{b.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="glass-panel rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">recorded cumulative totals (prior repository)</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {HISTORICAL_CUMULATIVE.map((c) => (
                <div key={c.label} className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold" title={c.label}>{c.value}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Alert variant="destructive" className="h-fit" role="alert">
          <TriangleAlert aria-hidden />
          <AlertTitle>Critical honesty note — most historical media are NOT present</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              The full 2,393-media binary set from these historical batches is NOT shipped (status:{" "}
              <span className="font-semibold">inaccessible</span>). Only the curated source-figure subset is bundled
              as static assets, each with source-document provenance; all other displayed media comes verified from
              the NASA Images API.
            </p>
            <p className="mt-2 font-mono text-[11px]">gap reference: gap-media-batch</p>
          </AlertDescription>
        </Alert>
      </section>

      <Separator className="bg-border/60" />

      <CuratedFigures />

      <Separator className="bg-border/60" />

      <SourceRegistry />

      <Separator className="bg-border/60" />

      <MediaCatalogue />

      <p className="provenance-strip flex items-start gap-2">
        <Files className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Every table above is re-verified by SHA-256 against the project manifest or the fetch ledger. If an asset
        cannot be verified, it is not displayed. This is the platform&apos;s honesty contract.
      </p>
    </div>
  );
}
