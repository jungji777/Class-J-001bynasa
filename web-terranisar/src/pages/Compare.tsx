import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RealCompareView, {
  type CompareMode,
} from "@/components/compare/RealCompareView";
import { StatsPanel } from "@/components/compare/StatsPanel";
import { DataSourcesDialog } from "@/components/DataSourcesDialog";
import { useNisarGranules } from "@/hooks/useNisar";
import { formatDate, type NisarGranule } from "@/lib/asf/client";

const MODES: { id: CompareMode; label: string }[] = [
  { id: "compare", label: "Comparar" },
  { id: "before", label: "Antes" },
  { id: "after", label: "Después" },
  { id: "diff", label: "Diferencia" },
];

const Compare = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CompareMode>("compare");
  const [afterId, setAfterId] = useState<string | null>(null);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);

  const query = useNisarGranules(["GCOV"]);
  const granules = query.data ?? [];

  // Después: granule más reciente elegido; Antes: la elección explícita del
  // usuario si es válida; si no, el par ideal es la pasada previa de la misma
  // pista/marco (ciclo de 12 días) y, si no existe, el anterior cronológico.
  const after = useMemo(
    () => granules.find((g) => g.fileID === afterId) ?? granules[0] ?? null,
    [granules, afterId],
  );
  const before = useMemo(() => {
    if (!after) return null;
    const chosen = beforeId
      ? granules.find((g) => g.fileID === beforeId)
      : undefined;
    if (chosen && chosen.fileID !== after.fileID) return chosen;
    const sameFrame = granules.find(
      (g) =>
        g.fileID !== after.fileID &&
        g.pathNumber === after.pathNumber &&
        g.frameNumber === after.frameNumber,
    );
    if (sameFrame) return sameFrame;
    const idx = granules.findIndex((g) => g.fileID === after.fileID);
    return granules[idx + 1] ?? null;
  }, [granules, after, beforeId]);

  const handleBack = useCallback(() => navigate("/explorar"), [navigate]);

  // Esc sale del modo enfoque
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUiHidden(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canCompare = before && after && before.fileID !== after.fileID;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {canCompare ? (
        <RealCompareView
          before={before}
          after={after}
          mode={mode}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="glass-strong max-w-md p-6 text-center">
            <p className="text-sm font-semibold">
              {query.isFetching
                ? "Consultando adquisiciones NISAR…"
                : query.isError
                  ? "Sin conexión con el ASF SearchAPI"
                  : "Se necesitan al menos dos adquisiciones para comparar."}
            </p>
          </div>
        </div>
      )}

      {/* Panel derecho (oculto en modo enfoque) */}
      {canCompare && !uiHidden && (
        <div className="pointer-events-none absolute right-5 top-5 z-10 md:right-7 md:top-7">
          <StatsPanel before={before} after={after} onBack={handleBack} />
        </div>
      )}

      {/* Título (oculto en modo enfoque) */}
      {!uiHidden && (
        <div className="glass rise-in pointer-events-none absolute left-5 top-5 z-10 px-4 py-3 md:left-7 md:top-7">
          <p className="text-sm font-bold tracking-tight">
            Comparador de fechas
          </p>
        </div>
      )}

      {/* Botón de modo enfoque (bajo el título) */}
      {!uiHidden && (
        <button
          type="button"
          onClick={() => setUiHidden(true)}
          className="glass glass-hover pointer-events-auto absolute left-5 top-[5.5rem] z-20 px-4 py-2 text-[12px] font-medium md:left-7"
        >
          Modo enfoque
        </button>
      )}

      {/* Barra inferior (oculta en modo enfoque) */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-5 md:bottom-7 md:px-7 ${uiHidden ? "hidden" : ""}`}>
        <div className="glass-strong rise-in pointer-events-auto flex items-center gap-3 p-2 pl-3">
          <div
            className="flex items-center gap-1"
            role="tablist"
            aria-label="Modo de comparación"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-lg px-3.5 py-2 text-[12px] font-medium transition-colors ${
                  mode === m.id
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10" />

          <GranuleSelect
            label="Antes"
            granules={granules}
            value={before}
            exclude={after?.fileID}
            onChange={(g) => setBeforeId(g.fileID)}
          />
          <GranuleSelect
            label="Después"
            granules={granules}
            value={after}
            exclude={before?.fileID}
            onChange={(g) => setAfterId(g.fileID)}
          />
        </div>
      </div>

      {/* Fuentes de datos (ocultas en modo enfoque) */}
      {!uiHidden && (
        <button
          type="button"
          onClick={() => setSourcesOpen(true)}
          aria-label="Fuentes de datos y citas"
          className="glass glass-hover pointer-events-auto absolute bottom-5 right-5 z-10 px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary md:bottom-7 md:right-7"
        >
          Fuentes
        </button>
      )}
      <DataSourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />

      {/* Mostrar interfaz: botón flotante y tecla Esc */}
      {uiHidden && (
        <button
          type="button"
          onClick={() => setUiHidden(false)}
          aria-label="Mostrar interfaz"
          className="glass glass-hover pointer-events-auto absolute right-5 top-5 z-20 px-4 py-2.5 text-sm font-medium md:right-7 md:top-7"
        >
          Mostrar interfaz
        </button>
      )}
    </div>
  );
};

function GranuleSelect({
  label,
  granules,
  value,
  exclude,
  onChange,
}: {
  label: string;
  granules: NisarGranule[];
  value: NisarGranule | null;
  exclude?: string;
  onChange: (g: NisarGranule) => void;
}) {
  return (
    <label className="relative flex items-center gap-2 pr-1 text-[11px] text-muted-foreground">
      {label}
      <span className="relative">
        <select
          value={value?.fileID ?? ""}
          onChange={(e) => {
            const g = granules.find((x) => x.fileID === e.target.value);
            if (g) onChange(g);
          }}
          className="font-mono-data appearance-none rounded-lg bg-white/5 py-1.5 pl-2.5 pr-7 text-[12px] text-foreground outline-none ring-1 ring-white/10 focus:ring-primary/50"
        >
          {value === null && <option value="">—</option>}
          {granules
            .filter((g) => g.fileID !== exclude)
            .map((g) => (
              <option key={g.fileID} value={g.fileID} className="bg-card">
                {formatDate(g.stopTime)} · p{g.pathNumber} f{g.frameNumber}
              </option>
            ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
        >
          ▾
        </span>
      </span>
    </label>
  );
}

export default Compare;
