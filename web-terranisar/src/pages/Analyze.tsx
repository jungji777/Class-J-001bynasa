import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AnalysisMap from "@/components/analyze/AnalysisMap";
import { SeriesPanel } from "@/components/analyze/SeriesPanel";
import { DataSourcesDialog } from "@/components/DataSourcesDialog";
import { useHondurasGeodata } from "@/hooks/useHondurasGeodata";
import { useNisarByPolygon } from "@/hooks/useNisar";
import { mainRing, ringToWkt, simplifyRingTo } from "@/lib/geo";

type Level = "GCOV" | "RSLC";
type Mode = "dept" | "draw";

const MAX_VERTICES = 120;

const Analyze = () => {
  const navigate = useNavigate();
  const { departments } = useHondurasGeodata();

  const [mode, setMode] = useState<Mode>("dept");
  const [deptName, setDeptName] = useState<string>("");
  const [points, setPoints] = useState<number[][]>([]);
  const [level, setLevel] = useState<Level>("GCOV");
  const [queryWkt, setQueryWkt] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState<string>("");
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const query = useNisarByPolygon(queryWkt, [level], 200);

  const dept = departments.find((d) => d.name === deptName) ?? null;

  /** Anillo de vista previa: lo que se dibuja o el departamento elegido
   *  (contorno principal simplificado, lo que realmente se consulta). */
  const previewRing = useMemo<number[][] | null>(() => {
    if (mode === "draw") return points.length ? points : null;
    if (!dept) return null;
    return simplifyRingTo(mainRing(dept.polys), MAX_VERTICES);
  }, [mode, points, dept]);

  const canAnalyze =
    mode === "dept"
      ? !!dept
      : points.length >= 3 && points.length <= MAX_VERTICES;

  const handleAnalyze = useCallback(() => {
    if (mode === "dept" && dept) {
      const ring = simplifyRingTo(mainRing(dept.polys), MAX_VERTICES);
      setQueryWkt(ringToWkt(ring));
      setAreaLabel(`departamento de ${dept.name}`);
    } else if (mode === "draw" && points.length >= 3) {
      setQueryWkt(ringToWkt(points));
      setAreaLabel(`área dibujada (${points.length} vértices)`);
    }
  }, [mode, dept, points]);

  const resetArea = useCallback(() => {
    setQueryWkt(null);
    setAreaLabel("");
  }, []);

  const handleAddVertex = useCallback(
    (lonLat: [number, number]) => {
      resetArea();
      setPoints((prev) =>
        prev.length >= MAX_VERTICES ? prev : [...prev, lonLat],
      );
    },
    [resetArea],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <AnalysisMap
          polygon={previewRing}
          vertices={mode === "draw" ? points : []}
          interactive={mode === "draw"}
          onAddVertex={handleAddVertex}
          granules={query.data ?? []}
        />
      </div>

      {/* Panel izquierdo de control */}
      <aside className="glass-strong rise-in pointer-events-auto absolute bottom-5 left-5 top-5 z-10 flex w-[320px] max-w-[calc(100vw-40px)] flex-col overflow-y-auto p-5 md:bottom-7 md:left-7 md:top-7">
        <button
          type="button"
          onClick={() => navigate("/explorar")}
          className="text-left text-[12px] text-muted-foreground transition-colors hover:text-primary"
        >
          ← Volver a explorar
        </button>

        <h1 className="mt-3 text-xl font-bold tracking-tight">
          Analizar área
        </h1>

        {/* Modo */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Área de análisis
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { key: "dept", label: "Departamento" },
                { key: "draw", label: "Dibujar" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMode(m.key);
                  resetArea();
                  if (m.key === "draw") setDeptName("");
                  else setPoints([]);
                }}
                className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                  mode === m.key
                    ? "bg-primary/15 text-primary ring-1 ring-primary/50"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "dept" ? (
          <div className="mt-4">
            <label
              htmlFor="dept-select"
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Departamento
            </label>
            <select
              id="dept-select"
              value={deptName}
              onChange={(e) => {
                setDeptName(e.target.value);
                resetArea();
              }}
              className="mt-2 w-full rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-primary/50"
            >
              <option value="">Elegir departamento…</option>
              {departments
                .map((d) => d.name)
                .sort((a, b) => a.localeCompare(b, "es"))
                .map((name) => (
                  <option key={name} value={name} className="bg-[#16212C]">
                    {name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Polígono dibujado
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Haz clic en el mapa para añadir vértices.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPoints((p) => p.slice(0, -1));
                  resetArea();
                }}
                disabled={points.length === 0}
                className="rounded-xl bg-white/5 px-3 py-2 text-[12px] ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                Deshacer
              </button>
              <button
                type="button"
                onClick={() => {
                  setPoints([]);
                  resetArea();
                }}
                disabled={points.length === 0}
                className="rounded-xl bg-white/5 px-3 py-2 text-[12px] ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                Limpiar
              </button>
              <span className="ml-auto font-mono-data text-[11px] text-muted-foreground">
                {points.length}/{MAX_VERTICES}
              </span>
            </div>
          </div>
        )}

        {/* Producto */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Producto científico
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { key: "GCOV", label: "GCOV · L2" },
                { key: "RSLC", label: "RSLC · L1" },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setLevel(p.key);
                  resetArea();
                }}
                className={`rounded-xl px-3 py-2 font-mono-data text-[12px] transition-colors ${
                  level === p.key
                    ? "bg-primary/15 text-primary ring-1 ring-primary/50"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="mt-5 flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-[13px] font-semibold text-[#0B1118] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Analizar adquisiciones
        </button>
      </aside>

      {/* Estado / resultados (a la derecha del panel de control para no
          tapar los controles) */}
      <div className="pointer-events-none absolute bottom-5 left-5 right-5 z-10 md:left-[372px] md:right-7 md:bottom-7">
        {queryWkt && (
          <div className="mx-auto max-w-5xl">
            {query.isFetching ? (
              <div className="glass rise-in mx-auto max-w-xl p-4">
                <p className="text-[12px] text-muted-foreground">
                  Consultando adquisiciones para {areaLabel}…
                </p>
              </div>
            ) : query.isError ? (
              <div className="glass rise-in mx-auto flex max-w-xl items-center justify-between gap-3 p-4">
                <p className="text-[12px]">
                  No se pudo consultar el ASF SearchAPI.
                </p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="pointer-events-auto ml-auto shrink-0 rounded-xl bg-white/10 px-3 py-2 text-[12px] hover:bg-white/15"
                >
                  Reintentar
                </button>
              </div>
            ) : query.data ? (
              <SeriesPanel
                granules={query.data}
                areaLabel={areaLabel}
                maxResults={200}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Fuentes de datos */}
      <button
        type="button"
        onClick={() => setSourcesOpen(true)}
        aria-label="Fuentes de datos y citas"
        className="glass glass-hover pointer-events-auto absolute bottom-5 right-5 z-10 px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary md:bottom-7 md:right-7"
      >
        Fuentes
      </button>
      <DataSourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
};

export default Analyze;
