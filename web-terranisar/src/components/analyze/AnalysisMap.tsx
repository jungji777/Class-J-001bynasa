import { useEffect, useRef } from "react";
import type { NisarGranule } from "@/lib/asf/client";
import { HONDURAS_BBOX } from "@/lib/sar/types";
import { useHondurasGeodata } from "@/hooks/useHondurasGeodata";
import { makeProjector } from "@/lib/geo";

interface AnalysisMapProps {
  /** Anillo de vista previa (abierto mientras se dibuja). */
  polygon: number[][] | null;
  /** Vértices a marcar (solo modo dibujo). */
  vertices?: number[][];
  interactive?: boolean;
  onAddVertex?: (lonLat: [number, number]) => void;
  /** Granules resultado del análisis (footprints tenues). */
  granules: NisarGranule[];
}

/**
 * Mapa canvas de Honduras para el análisis por polígono: base con
 * departamentos y contorno, editor de vértices por clic y footprints
 * de los granules resultantes.
 */
const AnalysisMap = ({
  polygon,
  vertices = [],
  interactive = false,
  onAddVertex,
  granules,
}: AnalysisMapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { departments, countryBorder } = useHondurasGeodata();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { minLon, maxLon, minLat, maxLat } = HONDURAS_BBOX;
      const { project } = makeProjector(w, h, HONDURAS_BBOX);

      ctx.fillStyle = "#0B1118";
      ctx.fillRect(0, 0, w, h);

      // Retícula
      ctx.strokeStyle = "rgba(143,162,176,0.10)";
      ctx.lineWidth = 1;
      for (let lon = -90; lon <= -82; lon += 1) {
        const [x1, y1] = project(lon, maxLat);
        const [, y2] = project(lon, minLat);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y2);
        ctx.stroke();
      }
      for (let lat = 13; lat <= 17; lat += 1) {
        const [x1, y1] = project(minLon, lat);
        const [x2] = project(maxLon, lat);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y1);
        ctx.stroke();
      }

      // Departamentos
      ctx.strokeStyle = "rgba(234,241,245,0.20)";
      ctx.lineWidth = 1;
      departments.forEach(({ polys }) =>
        polys.forEach((poly) => {
          ctx.beginPath();
          poly.forEach(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
        }),
      );

      // Contorno del país
      if (countryBorder.length) {
        ctx.strokeStyle = "rgba(127,214,194,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        countryBorder.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // Footprints de los granules resultado
      granules.forEach((g) => {
        ctx.beginPath();
        g.footprint.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(242,182,109,0.045)";
        ctx.fill();
        ctx.strokeStyle = "rgba(242,182,109,0.20)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Polígono de análisis
      if (polygon && polygon.length >= 2) {
        const closed = polygon.length >= 3;
        if (closed) {
          ctx.beginPath();
          polygon.forEach(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = "rgba(127,214,194,0.14)";
          ctx.fill();
        }
        ctx.beginPath();
        polygon.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (closed) ctx.closePath();
        ctx.strokeStyle = "rgba(127,214,194,1)";
        ctx.lineWidth = 2;
        ctx.setLineDash(interactive ? [6, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marcadores de vértice
        polygon.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          const isLast = i === polygon.length - 1;
          ctx.beginPath();
          ctx.arc(x, y, isLast && interactive ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = isLast && interactive ? "#F2B66D" : "#7FD6C2";
          ctx.fill();
          ctx.strokeStyle = "rgba(11,17,24,0.9)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
    };

    draw();
    window.addEventListener("resize", draw);
    const redraw = () => draw();
    canvas.addEventListener("redraw", redraw);
    return () => {
      window.removeEventListener("resize", draw);
      canvas.removeEventListener("redraw", redraw);
    };
  }, [polygon, vertices, granules, departments, countryBorder, interactive]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !onAddVertex) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { unproject } = makeProjector(
      canvas.clientWidth,
      canvas.clientHeight,
      HONDURAS_BBOX,
    );
    const [lon, lat] = unproject(e.clientX - rect.left, e.clientY - rect.top);
    // Solo vértices dentro del bbox con un pequeño margen
    if (
      lon >= HONDURAS_BBOX.minLon - 0.3 &&
      lon <= HONDURAS_BBOX.maxLon + 0.3 &&
      lat >= HONDURAS_BBOX.minLat - 0.3 &&
      lat <= HONDURAS_BBOX.maxLat + 0.3
    ) {
      onAddVertex([
        Math.round(lon * 1000) / 1000,
        Math.round(lat * 1000) / 1000,
      ]);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`h-full w-full ${interactive ? "cursor-crosshair" : ""}`}
      aria-label="Mapa de análisis por polígono sobre Honduras"
    />
  );
};

export default AnalysisMap;
