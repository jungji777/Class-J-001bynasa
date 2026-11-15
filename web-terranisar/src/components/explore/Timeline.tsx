import { formatDate, formatTime } from "@/lib/asf/client";
import type { NisarGranule } from "@/lib/asf/client";

interface TimelineProps {
  granules: NisarGranule[];
  selectedId: string | null;
  onSelect: (g: NisarGranule) => void;
  playing: boolean;
  onPlayPause: () => void;
  canPlay: boolean;
}

/** Línea de tiempo de adquisiciones NISAR reales, en orden cronológico. */
export function Timeline({
  granules,
  selectedId,
  onSelect,
  playing,
  onPlayPause,
  canPlay,
}: TimelineProps) {
  if (granules.length === 0) return null;

  return (
    <div
      className="glass-strong rise-in pointer-events-auto mx-auto w-full max-w-4xl p-4"
      style={{ animationDelay: "120ms" }}
      role="radiogroup"
      aria-label="Adquisiciones NISAR disponibles"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Adquisiciones · {granules.length} granules
        </p>
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!canPlay}
          aria-label={
            playing ? "Pausar reproducción" : "Reproducir time-lapse"
          }
          className={`rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-40 ${
            playing
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(127,214,194,0.45)]"
              : "bg-white/10 text-foreground hover:bg-white/15"
          }`}
        >
          {playing ? "Pausa" : "Play"}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {granules.map((g) => {
          const active = g.fileID === selectedId;
          return (
            <button
              key={g.fileID}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(g)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left transition-colors ${
                active
                  ? "bg-primary/15 ring-1 ring-primary/50"
                  : "ring-1 ring-white/10 hover:bg-white/5"
              }`}
            >
              <span
                className={`block text-[13px] font-semibold ${
                  active ? "text-primary" : ""
                }`}
              >
                {formatDate(g.stopTime)}
              </span>
              <span className="font-mono-data block text-[10px] text-muted-foreground">
                {formatTime(g.stopTime)} ·{" "}
                {g.flightDirection === "ASCENDING" ? "Asc" : "Desc"} · p
                {g.pathNumber} f{g.frameNumber}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
