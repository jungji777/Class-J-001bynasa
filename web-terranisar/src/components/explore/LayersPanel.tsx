import { formatDate } from "@/lib/asf/client";
import type { NisarGranule } from "@/lib/asf/client";

export interface BrowseOption {
  key: string;
  url: string;
  label: string;
  note: string;
}

interface LayersPanelProps {
  processingLevel: "GCOV" | "RSLC";
  onProcessingLevelChange: (p: "GCOV" | "RSLC") => void;
  granule: NisarGranule | null;
  browseOptions: BrowseOption[];
  selectedBrowse: string;
  onBrowseChange: (url: string) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
  showDepartments: boolean;
  onDepartmentsChange: (v: boolean) => void;
  onBack: () => void;
  onFullscreen?: () => void;
}

export function LayersPanel({
  processingLevel,
  onProcessingLevelChange,
  granule,
  browseOptions,
  selectedBrowse,
  onBrowseChange,
  opacity,
  onOpacityChange,
  showDepartments,
  onDepartmentsChange,
  onBack,
  onFullscreen,
}: LayersPanelProps) {
  return (
    <aside className="glass-strong rise-in pointer-events-auto flex w-80 flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver al globo"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/10"
          >
            ←
          </button>
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-tight">Explorar Honduras</h1>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              NISAR · ASF DAAC
            </p>
          </div>
        </div>
      </div>

      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Producto
      </p>
      <div className="mb-4 space-y-1">
        {(
          [
            { id: "GCOV" as const, label: "GCOV · L2" },
            { id: "RSLC" as const, label: "RSLC · L1" },
          ]
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onProcessingLevelChange(p.id)}
            className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
              processingLevel === p.id
                ? "bg-primary/15 ring-1 ring-primary/40"
                : "hover:bg-white/5"
            }`}
            aria-pressed={processingLevel === p.id}
          >
            <span className="flex items-center justify-between">
              <span className="text-[13px] font-medium">{p.label}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  processingLevel === p.id ? "bg-primary" : "bg-white/15"
                }`}
              />
            </span>
          </button>
        ))}
      </div>

      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Vista
      </p>
      <div className="mb-4 space-y-1">
        {browseOptions.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onBrowseChange(b.key)}
            className={`w-full rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
              selectedBrowse === b.key
                ? "bg-primary/15 ring-1 ring-primary/40 font-medium"
                : "hover:bg-white/5 text-muted-foreground"
            }`}
          >
            {b.label}
          </button>
        ))}
        {browseOptions.length === 0 && (
          <p className="px-3 text-[11px] text-muted-foreground">
            Selecciona una adquisición en la línea de tiempo.
          </p>
        )}
      </div>

      {onFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          disabled={browseOptions.length === 0}
          className="mb-4 flex w-full items-center justify-center rounded-xl bg-white/5 px-3 py-2.5 text-[12px] font-medium ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          Ver 1:1
        </button>
      )}

      <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Opacidad
        <span className="font-mono-data text-primary">
          {Math.round(opacity * 100)}%
        </span>
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(opacity * 100)}
        onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
        className="mb-4 w-full accent-[#7FD6C2]"
        aria-label="Opacidad del quicklook"
      />

      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Superposiciones
      </p>
      <ToggleRow
        label="Límites departamentales"
        checked={showDepartments}
        onChange={onDepartmentsChange}
      />

      {granule && (
        <div className="mt-4 rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Adquisición seleccionada
          </p>
          <dl className="font-mono-data space-y-1 text-muted-foreground">
            <div className="flex justify-between gap-2">
              <dt>Adquisición</dt>
              <dd className="text-right text-foreground">
                {formatDate(granule.stopTime)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Pasada</dt>
              <dd className="text-right text-foreground">
                {granule.flightDirection === "ASCENDING" ? "Asc." : "Desc."} ·
                pista {granule.pathNumber} · marco {granule.frameNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Procesado</dt>
              <dd className="text-right text-foreground">
                {granule.processingDate
                  ? formatDate(granule.processingDate)
                  : "—"}
              </dd>
            </div>
          </dl>
          <a
            href={`https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=${granule.fileID}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 flex items-center gap-1.5 text-primary hover:underline"
          >
            Abrir en ASF Vertex <span aria-hidden>↗</span>
          </a>
        </div>
      )}
    </aside>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
    >
      <span className="text-[13px] font-medium">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary/80" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
