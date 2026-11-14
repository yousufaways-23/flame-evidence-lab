"use client";

/**
 * MediaLibraryView — experimental media library replacing the former 3D Lab.
 *
 * Content, all in experimental context:
 *  1. Official NASA mission videos (oEmbed-verified, privacy-enhanced embed on
 *     click, honest source-type labels, mapped to PSI accessions).
 *  2. Curated research videos (existing verified VideoShelf registry).
 *  3. Authentic NASA imagery (NASA Images and Video Library index, search +
 *     lightbox, credit NASA).
 *
 * No WebGL, no simulations — every item is a real primary or labelled
 * secondary source. Nothing is presented as NASA footage unless it is.
 */

import { useMemo, useState } from "react";
import { Clapperboard, ExternalLink, Info, PlayCircle, Search, X } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import missionVideosDoc from "@/data/generated/mission-videos.json";
import { getInvestigation, searchMediaLocal, type MediaItem } from "@/lib/data/catalog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VideoShelf } from "@/components/flame/shell/VideoShelf";
import { cn } from "@/lib/utils";

interface MissionVideo {
  id: string;
  provider: "youtube" | "link";
  url?: string;
  title: string;
  channel: string;
  sourceType: string;
  program: string;
  overview: string;
  mapsTo: string[];
  placement: string[];
}

const SOURCE_LABEL: Record<string, string> = {
  "nasa-official": "NASA official",
  "university-lab": "university lab (not NASA)",
  "independent-science-communicator": "independent communicator (not NASA)",
  "independent-news": "independent news (not NASA)",
};

const PROGRAM_GROUPS = [
  { id: "all", label: "All programs" },
  { id: "droplet", label: "Droplet & cool flames" },
  { id: "diffusion", label: "Diffusion & hot flames" },
  { id: "spacecraft-fire", label: "Spacecraft fire (SAFFIRE · SSCE)" },
  { id: "solids", label: "Solid fuels (BASS)" },
  { id: "facilities", label: "Facilities (CIR)" },
  { id: "overviews", label: "Overviews & education" },
] as const;

type GroupId = (typeof PROGRAM_GROUPS)[number]["id"];

function groupFor(v: MissionVideo): GroupId {
  const p = `${v.program} ${v.title}`.toLowerCase();
  if (/droplet|cool flame/.test(p)) return "droplet";
  if (/diffusion|hot flame/.test(p)) return "diffusion";
  if (/saffire|spacecraft fire|solid surface/.test(p)) return "spacecraft-fire";
  if (/bass|solid fuel/.test(p)) return "solids";
  if (/facility|rack/.test(p)) return "facilities";
  return "overviews";
}

/* ------------------------------------------------------------------ */
/* Video card with click-to-embed facade                               */
/* ------------------------------------------------------------------ */

function MissionVideoCard({ video }: { video: MissionVideo }) {
  const openInvestigation = useAppStore((s) => s.openInvestigation);
  const setCopilotContext = useAppStore((s) => s.setCopilotContext);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);
  const [embedded, setEmbedded] = useState(false);

  const isYouTube = video.provider === "youtube";
  const watchUrl = isYouTube ? `https://www.youtube.com/watch?v=${video.id}` : video.url ?? "#";
  const embedUrl = isYouTube
    ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`
    : null;
  const thumb = isYouTube ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null;
  const mapped = video.mapsTo.filter((a) => Boolean(getInvestigation(a)));

  return (
    <article className="glass-panel flex flex-col overflow-hidden rounded-xl">
      {/* media area — facade first, iframe mounts only on click (privacy + performance) */}
      {embedded && embedUrl ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (embedUrl ? setEmbedded(true) : window.open(watchUrl, "_blank", "noopener,noreferrer"))}
          className="group relative block w-full cursor-pointer"
          aria-label={embedUrl ? `Play video: ${video.title}` : `Open ${video.title} on ${video.channel}`}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={`${video.title} — ${video.channel}`}
              loading="lazy"
              className="aspect-video w-full bg-white/5 object-cover transition-opacity group-hover:opacity-85"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[#0a1638] to-[#12245c]">
              <Clapperboard className="h-10 w-10 text-[#5799d1]" aria-hidden="true" />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/30 transition-transform group-hover:scale-110">
              <PlayCircle className="h-7 w-7 text-white" aria-hidden="true" />
            </span>
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85">
            {embedUrl ? "play embedded" : "open at nasa.gov"}
          </span>
        </button>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className={cn(
              "px-1.5 py-0 text-[10px]",
              video.sourceType === "nasa-official"
                ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/15"
                : "border-[#5799d1]/40 bg-[#5799d1]/10 text-[#5799d1] hover:bg-[#5799d1]/10",
            )}
          >
            {SOURCE_LABEL[video.sourceType] ?? video.sourceType}
          </Badge>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{video.program}</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{video.title}</h3>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{video.overview}</p>

        {mapped.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence:</span>
            {mapped.map((acc) => (
              <button
                key={acc}
                onClick={() => openInvestigation(acc)}
                title={`Open investigation ${acc}`}
                className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                {acc}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
          <span className="truncate text-[10px] text-muted-foreground">
            {video.channel} · verified via oEmbed 2026-11-14
          </span>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-primary hover:underline"
            onClick={() => {
              setCopilotContext(`The user opened the NASA video "${video.title}" (${video.program}) from the Media Library.`);
              setCopilotOpen(false);
            }}
          >
            Watch on source <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Imagery search + lightbox                                           */
/* ------------------------------------------------------------------ */

const IMAGE_PRESETS = [
  "Combustion Integrated Rack",
  "ACME",
  "FLEX droplet",
  "SAFFIRE",
  "BASS",
  "smoke aerosol",
  "cool flame",
  "glovebox",
];

function ImageryExplorer() {
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  const items = useMemo(() => {
    const q = query.trim();
    return q ? searchMediaLocal(q, 36) : searchMediaLocal("microgravity combustion", 24);
  }, [query]);

  return (
    <section className="flex flex-col gap-3">
      <div className="glass-panel flex flex-wrap items-center gap-2.5 rounded-xl p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the authentic NASA image index…"
            className="h-9 pl-8 text-sm"
            aria-label="Search authentic NASA imagery"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setQuery(p === query ? "" : p)}
              aria-pressed={query === p}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                query === p
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {items.length} items · credit NASA
        </span>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-sm text-muted-foreground">
          No imagery matched “{query}” in the local NASA media index — try a broader term.
        </div>
      ) : (
        <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
          {items.map((m) => (
            <figure key={m.nasa_id} className="research-panel mb-3 break-inside-avoid overflow-hidden rounded-lg">
              <button
                className="block w-full cursor-zoom-in"
                onClick={() => setLightbox(m)}
                aria-label={`Open image: ${m.title}`}
              >
                <img
                  src={m.thumb}
                  alt={`${m.title} — credit NASA`}
                  loading="lazy"
                  className="w-full bg-white/5 object-cover transition-opacity hover:opacity-90"
                />
              </button>
              <figcaption className="p-2.5 text-left">
                <div className="line-clamp-1 text-xs font-medium" title={m.title}>
                  {m.title}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="shrink-0">
                    {m.center} · {m.date_created?.slice(0, 10) ?? "—"}
                  </span>
                  <span className="truncate font-mono">NASA · {m.nasa_id}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-border/60 bg-[color:var(--space-panel)] p-0">
          {lightbox && (
            <>
              <img src={lightbox.full} alt={lightbox.title} className="max-h-[62vh] w-full bg-black/40 object-contain" />
              <div className="max-h-[24vh] overflow-y-auto p-4">
                <DialogTitle className="text-left text-sm leading-snug">{lightbox.title}</DialogTitle>
                <DialogDescription className="mt-1.5 text-left text-xs leading-relaxed">
                  {lightbox.description || "No description recorded."}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="font-mono">NASA · {lightbox.nasa_id}</span>
                  <span>{lightbox.center}</span>
                  <span>{lightbox.date_created?.slice(0, 10) ?? "—"}</span>
                  <span className="provenance-strip">{lightbox.provenance}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function MediaLibraryView() {
  const videos = useMemo(() => missionVideosDoc.videos as MissionVideo[], []);
  const [group, setGroup] = useState<GroupId>("all");

  const filtered = useMemo(
    () => (group === "all" ? videos : videos.filter((v) => groupFor(v) === group)),
    [videos, group],
  );
  const nasaOfficial = videos.filter((v) => v.sourceType === "nasa-official").length;

  return (
    <div className="min-w-0 pb-24">
      <header className="mb-5">
        <h1 className="text-2xl font-bold ember-gradient-text sm:text-3xl">Media Library — official NASA mission media</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          The footage behind the datasets: droplet combustion, cool flames, spherical diffusion flames,
          spacecraft-fire demonstrations and the facilities that hosted them. Every video is
          oEmbed-verified and labelled by true source type; every image comes from the NASA Images and
          Video Library.
        </p>
        <p className="provenance-strip mt-2 max-w-3xl">
          {videos.length} curated videos ({nasaOfficial} on official NASA channels) · imagery: NASA Images
          and Video Library (images.nasa.gov) — credit NASA. Non-NASA uploads are labelled as such and are
          never presented as NASA footage.
        </p>
      </header>

      {/* program filter */}
      <div className="glass-panel mb-5 flex flex-wrap items-center gap-1.5 rounded-xl p-3" role="group" aria-label="Filter videos by program">
        {PROGRAM_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            aria-pressed={group === g.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              group === g.id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* official mission videos */}
      <section aria-label="Official NASA mission videos" className="mb-8">
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <MissionVideoCard key={v.id} video={v} />
          ))}
        </div>
      </section>

      {/* curated educational videos (existing verified registry) */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Curated research context videos</h2>
        <VideoShelf context="media" />
      </section>

      {/* authentic imagery */}
      <section aria-label="Authentic NASA imagery">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Authentic NASA imagery</h2>
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          <Info className="mr-1 inline h-3 w-3" aria-hidden />
          Searchable index of authentic NASA photography of the experiments, hardware and facilities —
          served from the NASA Images and Video Library; imagery credit NASA.
        </p>
        <ImageryExplorer />
      </section>
    </div>
  );
}
