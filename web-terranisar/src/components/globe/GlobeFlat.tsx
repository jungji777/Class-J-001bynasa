import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { formatLatLon } from "@/lib/globe/geo";
import type { GlobeHandle, GlobeLayers } from "./GlobeCanvas";

/** Honduras centroid — same focus as the 3D globe. */
const HONDURAS = { lat: 14.85, lon: -86.6 };

interface GlobeFlatProps {
  layers: GlobeLayers;
  onCursor?: (coords: string | null) => void;
}

interface Star {
  x: number; // fracción del lienzo
  y: number;
  phase: number;
  speed: number;
  size: number;
}

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 8;
/** Ancho del mundo (en anchos de lienzo) con zoom 1. */
const BASE_WORLD_WIDTH = 2.4;

/**
 * Respaldo 2D del globo para navegadores sin WebGL: proyección plate
 * carrée de la textura nocturna real (misma de la esfera 3D), contorno de
 * Honduras, faro pulsante, arrastre para desplazar, zoom y lectura de
 * coordenadas. Mantiene la portada usable sin GPU.
 */
const GlobeFlat = forwardRef<GlobeHandle, GlobeFlatProps>(
  ({ layers, onCursor }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const borderRef = useRef<number[][]>([]);
    const centerRef = useRef({ ...HONDURAS });
    const zoomRef = useRef(1);
    const targetRef = useRef<{
      center: { lat: number; lon: number };
      zoom: number;
      from: { lat: number; lon: number };
      fromZoom: number;
      t: number;
      duration: number;
    } | null>(null);
    const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(
      null,
    );
    const layersRef = useRef(layers);
    layersRef.current = layers;
    const [imgReady, setImgReady] = useState(false);

    const stars = useRef<Star[]>(
      Array.from({ length: 160 }, () => ({
        x: Math.random(),
        y: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.4,
        size: 0.6 + Math.random() * 1.2,
      })),
    );

    useImperativeHandle(ref, () => ({
      zoomBy(factor: number) {
        const c = centerRef.current;
        targetRef.current = {
          center: { ...c },
          zoom: THREE_noopClamp(zoomRef.current * factor),
          from: { ...c },
          fromZoom: zoomRef.current,
          t: 0,
          duration: 0.45,
        };
      },
      flyTo(lat: number, lon: number) {
        const c = centerRef.current;
        targetRef.current = {
          center: { lat, lon },
          zoom: Math.max(zoomRef.current, 2.2),
          from: { ...c },
          fromZoom: zoomRef.current,
          t: 0,
          duration: 1.2,
        };
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImgReady(true);
      };
      img.src = "/textures/earth-night.jpg";

      fetch("/geo/hnd.json")
        .then((r) => r.json())
        .then(
          (
            g: {
              features: { geometry: { coordinates: number[][][] } }[];
            },
          ) => {
            borderRef.current = g.features[0].geometry.coordinates[0] ?? [];
          },
        )
        .catch(() => undefined);
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let frame = 0;
      const draw = (ts: number) => {
        frame = requestAnimationFrame(draw);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;
        const dpr = window.devicePixelRatio;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Animación de vuelo/zoom
        const target = targetRef.current;
        if (target) {
          target.t += 1 / 60 / target.duration;
          const k = Math.min(1, target.t);
          const e = k * k * (3 - 2 * k); // smoothstep
          centerRef.current = {
            lat: target.from.lat + (target.center.lat - target.from.lat) * e,
            lon: target.from.lon + (target.center.lon - target.from.lon) * e,
          };
          zoomRef.current =
            target.fromZoom + (target.zoom - target.fromZoom) * e;
          if (k >= 1) targetRef.current = null;
        }

        const c = centerRef.current;
        const zoom = zoomRef.current;
        const ppd = (w * BASE_WORLD_WIDTH * zoom) / 360; // px por grado
        const worldW = 360 * ppd;
        const worldH = 180 * ppd;

        ctx.fillStyle = "#0B1118";
        ctx.fillRect(0, 0, w, h);

        // Estrellas de fondo (visibles alrededor del mundo)
        const t = ts / 1000;
        ctx.fillStyle = "rgba(159,180,196,0.8)";
        stars.current.forEach((s) => {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.phase));
          ctx.globalAlpha = tw * 0.7;
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Origen (esquina sup. izq.) del mundo equirectangular
        const ox = w / 2 - (c.lon + 180) * ppd;
        const oy = h / 2 - (90 - c.lat) * ppd;

        // Textura nocturna real con fundido
        const img = imgRef.current;
        if (img) {
          ctx.globalAlpha = 0.92;
          ctx.drawImage(img, ox, oy, worldW, worldH);
          ctx.globalAlpha = 1;
          // Velo azul-noche para integrar la textura con el tema
          ctx.fillStyle = "rgba(11,17,24,0.28)";
          ctx.fillRect(Math.max(0, ox), Math.max(0, oy),
            Math.min(w, ox + worldW) - Math.max(0, ox),
            Math.min(h, oy + worldH) - Math.max(0, oy));
        }

        const px = (lon: number) => ox + (lon + 180) * ppd;
        const py = (lat: number) => oy + (90 - lat) * ppd;

        // Graticule
        if (layersRef.current.graticule) {
          ctx.strokeStyle = "rgba(143,162,176,0.18)";
          ctx.lineWidth = 1;
          for (let lon = -180; lon <= 180; lon += 15) {
            ctx.beginPath();
            ctx.moveTo(px(lon), py(90));
            ctx.lineTo(px(lon), py(-90));
            ctx.stroke();
          }
          for (let lat = -75; lat <= 75; lat += 15) {
            ctx.beginPath();
            ctx.moveTo(px(-180), py(lat));
            ctx.lineTo(px(180), py(lat));
            ctx.stroke();
          }
        }

        // Contorno de Honduras
        const border = borderRef.current;
        if (border.length && layersRef.current.border) {
          ctx.beginPath();
          border.forEach(([lon, lat], i) => {
            const x = px(lon);
            const y = py(lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.strokeStyle = "rgba(127,214,194,0.95)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Faro pulsante
        const bx = px(HONDURAS.lon);
        const by = py(HONDURAS.lat);
        const pulse = 1 + Math.sin(t * 2.4) * 0.35;
        const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 26 * pulse);
        halo.addColorStop(0, "rgba(127,214,194,0.55)");
        halo.addColorStop(1, "rgba(127,214,194,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(bx, by, 26 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7FD6C2";
        ctx.beginPath();
        ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
        ctx.fill();

        // Viñeta
        const vig = ctx.createRadialGradient(
          w / 2,
          h / 2,
          Math.min(w, h) * 0.4,
          w / 2,
          h / 2,
          Math.max(w, h) * 0.75,
        );
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(4,8,13,0.55)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      };
      frame = requestAnimationFrame(draw);

      const onPointerDown = (e: PointerEvent) => {
        dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
        canvas.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const drag = dragRef.current;
        if (drag) {
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
          const zoom = zoomRef.current;
          const ppd = (canvas.clientWidth * BASE_WORLD_WIDTH * zoom) / 360;
          const c = centerRef.current;
          centerRef.current = {
            lon: clamp(c.lon - dx / ppd, -180, 180),
            lat: clamp(c.lat + dy / ppd, -85, 85),
          };
          drag.x = e.clientX;
          drag.y = e.clientY;
          targetRef.current = null;
          return;
        }
        // Lectura de coordenadas
        const zoom = zoomRef.current;
        const ppd = (canvas.clientWidth * BASE_WORLD_WIDTH * zoom) / 360;
        const c = centerRef.current;
        const lon = c.lon + (e.clientX - rect.left - canvas.clientWidth / 2) / ppd;
        const lat = c.lat - (e.clientY - rect.top - canvas.clientHeight / 2) / ppd;
        if (lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
          onCursor?.(formatLatLon(lat, lon));
        } else {
          onCursor?.(null);
        }
      };
      const onPointerUp = () => {
        dragRef.current = null;
      };
      const onPointerLeave = () => {
        dragRef.current = null;
        onCursor?.(null);
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoomRef.current = clamp(
          zoomRef.current * (e.deltaY < 0 ? 1.12 : 0.89),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        targetRef.current = null;
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        cancelAnimationFrame(frame);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("wheel", onWheel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imgReady]);

    return (
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          aria-label="Mapa nocturno de Honduras (modo sin WebGL)"
        />
        <div className="glass pointer-events-none absolute left-1/2 top-20 flex max-w-md -translate-x-1/2 items-center gap-2 px-3.5 py-2 text-center">
          <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Tu navegador tiene WebGL desactivado: se muestra el mapa plano.
            Activa «Aceleración de hardware» en chrome://settings/system para
            ver el globo 3D.
          </p>
        </div>
      </div>
    );
  },
);

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Contención de zoom con los mismos límites del globo 3D. */
function THREE_noopClamp(v: number): number {
  return clamp(v, MIN_ZOOM, MAX_ZOOM);
}

GlobeFlat.displayName = "GlobeFlat";
export default GlobeFlat;
