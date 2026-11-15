import { daysBetween, formatDate, formatTime, type NisarGranule } from "@/lib/asf/client";

interface StatsPanelProps {
  before: NisarGranule;
  after: NisarGranule;
  onBack: () => void;
}

function GranuleCard({ g, tag }: { g: NisarGranule; tag: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {tag}
        </p>
        <span className="font-mono-data text-[11px] font-semibold text-foreground">
          {formatDate(g.stopTime)}
        </span>
      </div>
      <dl className="font-mono-data space-y-1 text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Pasada</dt>
          <dd className="text-right text-foreground">
            {g.flightDirection === "ASCENDING" ? "Ascendente" : "Descendente"} ·
            p{g.pathNumber} f{g.frameNumber}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Adquisición</dt>
          <dd className="text-right text-foreground">{formatTime(g.stopTime)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Producto</dt>
          <dd className="text-right text-foreground">{g.processingLevel}</dd>
        </div>
        {g.bytesH5 && (
          <div className="flex justify-between gap-2">
            <dt>HDF5</dt>
            <dd className="text-right text-foreground">
              {(g.bytesH5 / 1e6).toFixed(0)} MB
            </dd>
          </div>
        )}
      </dl>
      <a
        href={`https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=${g.fileID}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center gap-1.5 text-[11px] text-primary hover:underline"
      >
        ASF Vertex <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

export function StatsPanel({ before, after, onBack }: StatsPanelProps) {
  const days = daysBetween(before, after);
  return (
    <aside className="glass-strong rise-in pointer-events-auto flex w-80 flex-col p-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Par comparado
        </p>
        <span className="font-mono-data text-[11px] font-semibold text-warning">
          Δ {days} días
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <GranuleCard g={before} tag="Antes" />
        <GranuleCard g={after} tag="Después" />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-auto w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
      >
        Volver a explorar
      </button>
    </aside>
  );
}
