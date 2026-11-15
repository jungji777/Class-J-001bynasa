import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/asf/client";
import type { NisarGranule } from "@/lib/asf/client";

interface QuicklookViewerProps {
  granule: NisarGranule | null;
  /** Vistas disponibles del granule (misma lista del panel de capas). */
  options: { key: string; url: string; label: string }[];
  initialKey?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  return ` (~${(bytes / 1_000_000_000).toFixed(1)} GB)`;
}

/** Visor a pantalla completa del quicklook oficial (PNG de ASF DAAC, 1:1). */
export function QuicklookViewer({
  granule,
  options,
  initialKey,
  onClose,
}: QuicklookViewerProps) {
  const [viewKey, setViewKey] = useState(initialKey ?? options[0]?.key ?? "");
  const view = options.find((o) => o.key === viewKey) ?? options[0];
  const [native, setNative] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reiniciar al cambiar de imagen
  useEffect(() => {
    setNative(null);
    setOffset({ x: 0, y: 0 });
  }, [viewKey, granule?.fileID]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !native) return;
    const s = Math.min(
      (wrap.clientWidth - 48) / native.w,
      (wrap.clientHeight - 96) / native.h,
      1,
    );
    setFitScale(s);
    setScale(s);
    setOffset({ x: 0, y: 0 });
  }, [native]);

  useEffect(() => {
    if (native) fit();
  }, [native, fit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=")
        setScale((s) => Math.min(MAX_SCALE, s * 1.25));
      if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s / 1.25));
      if (e.key === "0") fit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, fit]);

  if (!granule || !view) return null;

  const zoomPct = Math.round((scale / (fitScale || 1)) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#04080d]/95 backdrop-blur-md"
      role="dialog"
      aria-label="Visor de quicklook a pantalla completa"
      onWheel={(e) => {
        e.preventDefault();
        setScale((s) =>
          Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.12 : 0.89))),
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">
            {formatDate(granule.stopTime)} ·{" "}
            {granule.flightDirection === "ASCENDING" ? "Asc" : "Desc"} · p
            {granule.pathNumber} f{granule.frameNumber}
          </p>
          <p className="font-mono-data truncate text-[10px] text-muted-foreground">
            {granule.sceneName}
          </p>
        </div>

        {options.length > 1 && (
          <div className="flex items-center gap-1" role="tablist">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="tab"
                aria-selected={o.key === viewKey}
                onClick={() => setViewKey(o.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  o.key === viewKey
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-white/10"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono-data mr-1 text-[11px] text-muted-foreground">
            {native ? `${native.w}×${native.h} px` : "cargando…"} · {zoomPct}%
          </span>
          <button
            type="button"
            aria-label="Alejar"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.25))}
            className="glass glass-hover flex h-8 w-8 items-center justify-center rounded-lg"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Acercar"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.25))}
            className="glass glass-hover flex h-8 w-8 items-center justify-center rounded-lg"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Ajustar a la pantalla"
            onClick={fit}
            className="glass glass-hover flex h-8 items-center justify-center rounded-lg px-2.5 text-[11px]"
          >
            Ajustar
          </button>
          <button
            type="button"
            aria-label="Ver a resolución nativa (100 %)"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="glass glass-hover flex h-8 items-center rounded-lg px-2.5 text-[11px]"
          >
            1:1
          </button>
          <button
            type="button"
            aria-label="Cerrar visor"
            onClick={onClose}
            className="glass glass-hover flex h-8 w-8 items-center justify-center rounded-lg text-base"
          >
            ×
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onDoubleClick={() => {
          if (Math.abs(scale - 1) < 0.01) fit();
          else {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }
        }}
        onPointerDown={(e) => {
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerLeave={() => (dragRef.current = null)}
      >
        <img
          src={view.url}
          alt={`Quicklook ${view.label} del granule ${granule.sceneName}`}
          draggable={false}
          onLoad={(e) =>
            setNative({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className="absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            imageRendering: scale / (fitScale || 1) > 3 ? "pixelated" : "auto",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3">
        <a
          href="https://urs.earthdata.nasa.gov/"
          target="_blank"
          rel="noreferrer"
          className="glass glass-hover rounded-lg px-3 py-1.5 text-[11px] font-medium"
        >
          Iniciar sesión NASA Earthdata
        </a>
        <a
          href={granule.url}
          className="glass glass-hover rounded-lg px-3 py-1.5 text-[11px] font-medium"
        >
          Descargar HDF5{fmtSize(granule.bytesH5)}
        </a>
        <a
          href={`https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=${granule.fileID}`}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-primary hover:underline"
        >
          ASF Vertex ↗
        </a>
      </div>
    </div>
  );
}
