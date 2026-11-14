"use client";

// ZERO FLARE — SourceFiguresGallery: figures extracted from the original
// NASA source documents (PSI reports and journal papers), curated at build
// time into a static asset bundle with per-figure provenance (source
// document, page, ingestion batch). No server filesystem access — the index
// is generated (src/data/generated/figures.json) and binaries live under
// /figures, so the gallery works identically in dev and production.

import { useMemo, useState } from "react";
import figuresDoc from "@/data/generated/figures.json";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileImage } from "lucide-react";

interface FigureItem {
  file: string;
  sourceFile: string;
  batchId: string;
  page: number | null;
  width: number | null;
  height: number | null;
  accession: string | null;
  facility: string | null;
  interpretation: string | null;
}

interface FiguresDoc {
  generatedAt: string;
  note: string;
  totalCurated: number;
  totalAvailable: number;
  items: FigureItem[];
}

export function SourceFiguresGallery({ accession, facilityName }: { accession?: string; facilityName?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const items = useMemo(() => {
    const doc = figuresDoc as FiguresDoc;
    if (accession) return doc.items.filter((it) => it.accession === accession);
    if (facilityName) return doc.items.filter((it) => it.facility === facilityName);
    return doc.items;
  }, [accession, facilityName]);

  if (items.length === 0) return null;
  const open = openIdx !== null ? items[openIdx] : null;

  return (
    <section className="flex flex-col gap-2.5" aria-label="Figures from the original NASA source documents">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileImage className="h-4 w-4 text-primary" aria-hidden />
          Figures from the original source documents
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {items.length} curated figures · extracted with page + batch provenance · not re-rendered data
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <figure key={it.file} className="research-panel overflow-hidden rounded-lg">
            <button
              className="block w-full cursor-zoom-in"
              onClick={() => setOpenIdx(i)}
              aria-label={`Enlarge figure from ${it.sourceFile}${it.page ? `, page ${it.page}` : ""}`}
            >
              <img
                src={it.file}
                alt={`Figure extracted from ${it.sourceFile}${it.page ? ` page ${it.page}` : ""}`}
                loading="lazy"
                className="max-h-56 w-full bg-white object-contain"
              />
            </button>
            <figcaption className="space-y-1 p-2.5 text-left">
              <p className="truncate text-[11px] font-medium" title={it.sourceFile}>
                {it.sourceFile}
                {it.page !== null && <span className="text-muted-foreground"> · p.{it.page}</span>}
              </p>
              {it.interpretation && (
                <p className="line-clamp-2 text-[10px] italic leading-snug text-muted-foreground" title={it.interpretation}>
                  {it.interpretation}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="px-1 py-0 text-[9px]">{it.batchId}</Badge>
                {it.facility && <span className="font-mono text-[9px] text-muted-foreground">{it.facility}</span>}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border-border/60 bg-[color:var(--space-panel)] p-0">
          {open && (
            <>
              <img src={open.file} alt={open.sourceFile} className="max-h-[70vh] w-full bg-white object-contain" />
              <div className="max-h-[20vh] overflow-y-auto p-4">
                <DialogHeader>
                  <DialogTitle className="text-left text-sm leading-snug">
                    {open.sourceFile}
                    {open.page !== null && <span className="text-muted-foreground"> · page {open.page}</span>}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 text-left text-xs leading-relaxed">
                    {open.interpretation ?? "Figure extracted from the source document by the ingestion pipeline."}
                  </DialogDescription>
                </DialogHeader>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  batch {open.batchId} · extracted {open.width ?? "?"}×{open.height ?? "?"}px · provenance: ingestion
                  receipt (source-document evidence)
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
