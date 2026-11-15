import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PlasmaProvider } from "@cruxgarden/plasma-ui";
import GlobeCanvas, {
  type GlobeHandle,
  type GlobeLayers,
} from "@/components/globe/GlobeCanvas";
import { TopBar } from "@/components/home/TopBar";
import { CountryCard } from "@/components/home/CountryCard";
import {
  CursorChip,
  MissionBadge,
  NorthIndicator,
  ZoomControls,
} from "@/components/home/MapControls";
import { HONDURAN_SITES } from "@/lib/globe/geo";

/** Centroide de Honduras — mismo foco inicial del globo. */
const HONDURAS = { lat: 14.85, lon: -86.6 };

const Index = () => {
  const navigate = useNavigate();
  const globeRef = useRef<GlobeHandle>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<string | null>(null);
  const [layers, setLayers] = useState<GlobeLayers>({
    border: true,
    lights: true,
    graticule: false,
  });
  // Canvas real del globo (3D o fallback 2D): Plasma lo muestrea en vivo
  // para refractar el contenido detrás de las superficies.
  const [globeCanvas, setGlobeCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const poll = () => {
      const el = globeWrapRef.current?.querySelector("canvas") ?? null;
      if (el) {
        setGlobeCanvas(el);
      } else if (tries++ < 60) {
        raf = requestAnimationFrame(poll);
      }
    };
    poll();
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const query = search.trim();
    if (!query) return;

    // 1) Coordinates: "14.07, -87.19" or "14.07 -87.19"
    const coordMatch = query.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        globeRef.current?.flyTo(lat, lon);
        toast.success(`Centrando en ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
        return;
      }
    }

    // 2) Known site name
    const q = query.toLowerCase();
    const site = HONDURAN_SITES.find(
      (s) =>
        s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase().split(" ")[0]),
    );
    if (site) {
      globeRef.current?.flyTo(site.lat, site.lon);
      toast.success(`${site.name} · ${site.note}`);
      return;
    }

    toast.error("Sin resultados. Prueba un sitio de Honduras o coordenadas.");
  }, [search]);

  const handleExplore = useCallback(
    () => navigate("/explorar"),
    [navigate],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={globeWrapRef} className="absolute inset-0">
        <GlobeCanvas
          ref={globeRef}
          layers={layers}
          onCursor={setCoords}
        />
      </div>

      {/*
        Plasma UI (liquid glass estilo Apple) sobre la portada.
        Parámetros deliberadamente sobrios: sin brillos, sin gotas,
        sin iridiscencia — solo vidrio oscuro frío con borde fino.
      */}
      <PlasmaProvider
        theme="dark"
        ground="clear"
        background={globeCanvas ?? undefined}
        zIndex={5}
        tint="#16212C"
        opacity={0.4}
        frost={0.34}
        radius={20}
        rim={0.3}
        rimColor="tint"
        rimWidth={0.8}
        highlight={0.22}
        edgeLine={0.55}
        shimmer={0}
        shimmerSpeed={0}
        glow={0}
        wash={0.3}
        grain={0.35}
        refraction={1}
        dispersion={0}
        viscosity={0.7}
        stretch={0.2}
        flow={0}
        elevation={0.3}
        pointerDrop={false}
        pointerPull={false}
        ambientDrops={false}
        formSpeed={1.6}
        formOut={false}
        maxSurfaces={8}
        quality={1.25}
      >
        <TopBar
          search={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearchSubmit}
          layers={layers}
          onLayersChange={setLayers}
        />

        {/* Bottom-left: territory selector */}
        <div className="pointer-events-none absolute bottom-5 left-5 z-10 md:bottom-7 md:left-7">
          <CountryCard onExplore={handleExplore} />
        </div>

        {/* Right rail: mission status + zoom + north */}
        <div className="pointer-events-none absolute right-5 top-24 z-10 flex flex-col items-end gap-2.5 md:right-7 md:top-28">
          <MissionBadge />
          <div className="mt-auto" />
        </div>
        {/* bottom-16: despeja la insignia de Rork (fija, abajo a la derecha) */}
        <div className="pointer-events-none absolute bottom-16 right-5 z-10 flex flex-col items-end gap-2.5 md:right-7">
          <NorthIndicator
            onRecenter={() => globeRef.current?.flyTo(HONDURAS.lat, HONDURAS.lon)}
          />
          <ZoomControls
            onZoomIn={() => globeRef.current?.zoomBy(0.72)}
            onZoomOut={() => globeRef.current?.zoomBy(1.38)}
          />
        </div>
      </PlasmaProvider>

      {/* HUD transitorio de coordenadas: sigue siendo vidrio CSS (aparece/desaparece) */}
      <CursorChip coords={coords} />
    </div>
  );
};

export default Index;
