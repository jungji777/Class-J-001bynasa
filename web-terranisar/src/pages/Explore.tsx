import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RealSarMap from "@/components/explore/RealSarMap";
import { LayersPanel, type BrowseOption } from "@/components/explore/LayersPanel";
import { Timeline } from "@/components/explore/Timeline";
import { DataSourcesDialog } from "@/components/DataSourcesDialog";
import { QuicklookViewer } from "@/components/QuicklookViewer";
import { useNisarGranules } from "@/hooks/useNisar";
import { formatDate } from "@/lib/asf/client";
import type { NisarGranule } from "@/lib/asf/client";
import { preloadBrowseImages } from "@/lib/asf/browseImage";

type Level = "GCOV" | "RSLC";

const Explore = () => {
  const navigate = useNavigate();
  const [processingLevel, setProcessingLevel] = useState<Level>("GCOV");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browseKey, setBrowseKey] = useState<string>("latlon");
  const [opacity, setOpacity] = useState(1);
  const [showDepartments, setShowDepartments] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const query = useNisarGranules([processingLevel]);
  const granules = query.data ?? [];

  /** Orden cronológico ascendente (más antiguo → más reciente) para el
   *  time-lapse. */
  const ordered = useMemo(() => [...granules].reverse(), [granules]);

  const selected = useMemo(
    () =>
      granules.find((g) => g.fileID === selectedId) ?? granules[0] ?? null,
    [granules, selectedId],
  );

  const browseOptions = useMemo<BrowseOption[]>(() => {
    if (!selected) return [];
    const b = selected.browse;
    const opts: BrowseOption[] = [];
    if (b.latlon)
      opts.push({ key: "latlon", url: b.latlon, label: "Geocodificada", note: "" });
    if (b.native)
      opts.push({ key: "native", url: b.native, label: "Nativa", note: "" });
    b.pols.forEach((p) =>
      opts.push({ key: p.key, url: p.url, label: p.label, note: "" }),
    );
    return opts;
  }, [selected]);

  const selectedBrowseUrl = browseOptions.find(
    (b) => b.key === browseKey,
  )?.url;

  const handleBack = useCallback(() => navigate("/"), [navigate]);
  const handleSelect = useCallback((g: NisarGranule) => {
    setSelectedId(g.fileID);
    setBrowseKey("latlon");
  }, []);

  // --- Time-lapse: reproduce las adquisiciones en secuencia ---------------
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // Precarga concurrente de quicklooks para reproducción fluida: se llena
  // la caché de todas las imágenes en cuanto empieza la reproducción.
  useEffect(() => {
    if (!playing) return;
    preloadBrowseImages(
      ordered.map((g) => g.browse.latlon).filter((u): u is string => !!u),
      () => playingRef.current,
    );
  }, [playing, ordered]);

  useEffect(() => {
    if (!playing || ordered.length < 2) return;
    const interval = setInterval(() => {
      setSelectedId((current) => {
        const idx = ordered.findIndex((g) => g.fileID === current);
        const next = (idx + 1) % ordered.length;
        return ordered[next].fileID;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [playing, ordered]);

  // Pausar si no hay suficientes granules o cambia el producto
  useEffect(() => {
    if (ordered.length < 2) setPlaying(false);
  }, [ordered.length]);

  // Esc sale del modo enfoque (el visor gestiona su propio Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUiHidden(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && ordered.length >= 2) {
        // Al iniciar, arrancar desde la adquisición más antigua
        setSelectedId((cur) => {
          const idx = ordered.findIndex((g) => g.fileID === cur);
          return idx === -1 || idx === ordered.length - 1
            ? ordered[0].fileID
            : cur;
        });
        setBrowseKey("latlon");
        return true;
      }
      return false;
    });
  }, [ordered]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <RealSarMap
          granules={granules}
          selected={selected}
          browseUrl={selectedBrowseUrl}
          opacity={opacity}
          showDepartments={showDepartments}
        />
      </div>

      {/* Panel izquierdo (oculto en modo enfoque) */}
      {!uiHidden && (
        <div className="pointer-events-none absolute bottom-5 left-5 top-5 z-10 flex md:bottom-7 md:left-7 md:top-7">
          <LayersPanel
            processingLevel={processingLevel}
            onProcessingLevelChange={(p) => {
              setProcessingLevel(p);
              setSelectedId(null);
              setBrowseKey("latlon");
            }}
            granule={selected}
            browseOptions={browseOptions}
            selectedBrowse={browseKey}
            onBrowseChange={setBrowseKey}
            opacity={opacity}
            onOpacityChange={setOpacity}
            showDepartments={showDepartments}
            onDepartmentsChange={setShowDepartments}
            onBack={handleBack}
            onFullscreen={() => setViewerOpen(true)}
          />
        </div>
      )}

      {/* Columna derecha: estado de datos y accesos */}
      <div className="pointer-events-none absolute right-5 top-5 z-10 flex flex-col items-end gap-2 md:right-7 md:top-7">
        {uiHidden ? (
          <button
            type="button"
            onClick={() => setUiHidden(false)}
            aria-label="Mostrar interfaz"
            className="glass glass-hover pointer-events-auto px-4 py-2.5 text-sm font-medium"
          >
            Mostrar interfaz
          </button>
        ) : (
          <>
            <div className="glass flex items-center gap-2 px-3.5 py-2">
          {query.isFetching ? (
            <span className="text-[11px] text-muted-foreground">
              Consultando ASF SearchAPI…
            </span>
          ) : query.isError ? (
            <span className="text-[11px]">Sin conexión con ASF DAAC</span>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-mono-data text-[11px]">
                {granules.length} granules · ASF DAAC
              </span>
            </>
          )}
        </div>

        {query.isError && (
          <button
            type="button"
            onClick={() => query.refetch()}
            className="glass glass-hover pointer-events-auto px-4 py-2.5 text-sm font-medium"
          >
            Reintentar
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/analizar")}
          className="glass glass-hover pointer-events-auto px-4 py-2.5 text-sm font-medium"
        >
          Analizar área
        </button>

        <button
          type="button"
          onClick={() => navigate("/comparar")}
          disabled={granules.length < 2}
          className="glass glass-hover pointer-events-auto px-4 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          Comparar fechas
        </button>

        <button
          type="button"
          onClick={() => setUiHidden(true)}
          className="glass glass-hover pointer-events-auto px-4 py-2.5 text-sm font-medium"
        >
          Modo enfoque
        </button>
          </>
        )}
      </div>

      {/* Línea de tiempo real (oculta en modo enfoque) */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-5 z-10 px-5 md:bottom-7 md:px-7 ${uiHidden ? "hidden" : ""}`}>
        {query.isError ? (
          <div className="glass rise-in mx-auto flex max-w-xl items-center justify-between gap-3 p-4">
            <p className="text-[12px]">
              No se pudo consultar el ASF SearchAPI.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="pointer-events-auto shrink-0 rounded-xl bg-white/10 px-3 py-2 text-[12px] hover:bg-white/15"
            >
              Reintentar
            </button>
          </div>
        ) : !query.data ? (
          <div className="glass rise-in mx-auto max-w-4xl p-4">
            <p className="text-[12px] text-muted-foreground">
              Cargando adquisiciones NISAR…
            </p>
          </div>
        ) : granules.length === 0 ? (
          <div className="glass rise-in mx-auto max-w-xl p-4">
            <p className="text-[12px]">
              Sin cobertura {processingLevel} sobre el punto de referencia.
            </p>
          </div>
        ) : (
          <Timeline
            granules={ordered}
            selectedId={selected?.fileID ?? null}
            onSelect={handleSelect}
            playing={playing}
            onPlayPause={togglePlay}
            canPlay={ordered.length >= 2}
          />
        )}
      </div>

      {/* Fuentes de datos (ocultas en modo enfoque) */}
      {!uiHidden && (
        <button
          type="button"
          onClick={() => setSourcesOpen(true)}
          aria-label="Fuentes de datos y citas"
          className="glass glass-hover pointer-events-auto absolute bottom-16 right-5 z-10 px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary md:right-7"
        >
          Fuentes
        </button>
      )}
      <DataSourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />

      {/* Visor a pantalla completa (píxeles nativos 1:1) */}
      {viewerOpen && (
        <QuicklookViewer
          granule={selected}
          options={browseOptions}
          initialKey={browseKey}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default Explore;
