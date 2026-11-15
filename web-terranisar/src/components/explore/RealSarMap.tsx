import { useEffect, useRef } from "react";
import { footprintBbox, type NisarGranule } from "@/lib/asf/client";
import { HONDURAS_BBOX } from "@/lib/sar/types";
import { useHondurasGeodata } from "@/hooks/useHondurasGeodata";
import { loadBrowseImage } from "@/lib/asf/browseImage";

interface RealSarMapProps {
  granules: NisarGranule[];
  selected: NisarGranule | null;
  browseUrl?: string;
  opacity: number;
  showDepartments: boolean;
}

const RealSarMap = ({
  granules,
  selected,
  browseUrl,
  opacity,
  showDepartments,
}: RealSarMapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { departments, countryBorder } = useHondurasGeodata();

  // Cargar el quicklook real del granule seleccionado
  useEffect(() => {
    let alive = true;
    if (!browseUrl) {
      imgRef.current = null;
      return;
    }
    loadBrowseImage(browseUrl)
      .then((img) => {
        if (alive) {
          imgRef.current = img;
          canvasRef.current?.dispatchEvent(new Event("redraw"));
        }
      })
      .catch(() => {
        if (alive) imgRef.current = null;
        canvasRef.current?.dispatchEvent(new Event("redraw"));
      });
    return () => {
      alive = false;
    };
  }, [browseUrl]);

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
      const bboxAspect =
        (maxLon - minLon) /
        ((maxLat - minLat) * Math.cos((15 * Math.PI) / 180));
      let mapW = w;
      let mapH = w / bboxAspect;
      if (mapH > h) {
        mapH = h;
        mapW = h * bboxAspect;
      }
      const offX = (w - mapW) / 2;
      const offY = (h - mapH) / 2;
      const project = (lon: number, lat: number): [number, number] => [
        offX + ((lon - minLon) / (maxLon - minLon)) * mapW,
        offY + ((maxLat - lat) / (maxLat - minLat)) * mapH,
      ];

      ctx.fillStyle = "#0B1118";
      ctx.fillRect(0, 0, w, h);

      // Retícula sutil
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
      if (showDepartments) {
        ctx.strokeStyle = "rgba(234,241,245,0.22)";
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
      }

      // Contorno del país
      if (countryBorder.length) {
        ctx.strokeStyle = "rgba(127,214,194,0.9)";
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

      // Footprints de todas las adquisiciones + seleccionado resaltado
      granules.forEach((g) => {
        const isSel = selected?.fileID === g.fileID;
        ctx.beginPath();
        g.footprint.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = isSel
          ? "rgba(127,214,194,0.10)"
          : "rgba(127,214,194,0.03)";
        ctx.fill();
        ctx.strokeStyle = isSel
          ? "rgba(127,214,194,0.9)"
          : "rgba(127,214,194,0.25)";
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.stroke();
      });

      // Quicklook real georreferenciado (plate carrée sobre el footprint)
      const img = imgRef.current;
      if (img && selected && selected.footprint.length > 2) {
        const bb = footprintBbox(selected.footprint);
        const [x0, y0] = project(bb.minLon, bb.maxLat);
        const [x1] = project(bb.maxLon, bb.maxLat);
        const [, y1] = project(bb.minLon, bb.minLat);
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
        const imgAspect = img.width / img.height;
        const boxAspect = (x1 - x0) / (y1 - y0);
        let dw = x1 - x0;
        let dh = y1 - y0;
        if (imgAspect > boxAspect) {
          dh = dw / imgAspect;
        } else {
          dw = dh * imgAspect;
        }
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
      }
    };

    draw();
    canvas.addEventListener("redraw", draw);
    window.addEventListener("resize", draw);
    return () => {
      canvas.removeEventListener("redraw", draw);
      window.removeEventListener("resize", draw);
    };
  }, [granules, selected, opacity, showDepartments, departments, countryBorder]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-label="Mapa de adquisiciones NISAR sobre Honduras"
    />
  );
};

export default RealSarMap;
