import { useCallback, useEffect, useRef, useState } from "react";
import type { NisarGranule } from "@/lib/asf/client";

export type CompareMode = "compare" | "before" | "after" | "diff";

interface RealCompareViewProps {
  before: NisarGranule;
  after: NisarGranule;
  mode: CompareMode;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("browse no disponible"));
    img.src = url;
  });
}

/** Dibuja una imagen cubriendo el lienzo (cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const ia = img.width / img.height;
  const ca = w / h;
  let dw = w;
  let dh = h;
  if (ia > ca) {
    dh = h;
    dw = h * ia;
  } else {
    dw = w;
    dh = w / ia;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const RealCompareView = ({ before, after, mode }: RealCompareViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let alive = true;
    setStatus("loading");

    Promise.all([
      loadImage(before.browse.latlon ?? before.browse.native ?? ""),
      loadImage(after.browse.latlon ?? after.browse.native ?? ""),
    ])
      .then(([imgBefore, imgAfter]) => {
        if (!alive) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        setStatus("ready");

        const dpr = window.devicePixelRatio;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.fillStyle = "#0B1118";
        ctx.fillRect(0, 0, w, h);

        if (mode === "diff") {
          // Diferencia visual de quicklooks (no radiométrica)
          const S = 512;
          const a = document.createElement("canvas");
          a.width = a.height = S;
          const b = document.createElement("canvas");
          b.width = b.height = S;
          const actx = a.getContext("2d")!;
          const bctx = b.getContext("2d")!;
          actx.drawImage(imgBefore, 0, 0, S, S);
          bctx.drawImage(imgAfter, 0, 0, S, S);
          const ad = actx.getImageData(0, 0, S, S);
          const bd = bctx.getImageData(0, 0, S, S);
          const out = new ImageData(S, S);
          for (let i = 0; i < ad.data.length; i += 4) {
            const delta =
              ((bd.data[i] + bd.data[i + 1] + bd.data[i + 2]) / 3 -
                (ad.data[i] + ad.data[i + 1] + ad.data[i + 2]) / 3) /
              255;
            const t = Math.min(1, Math.abs(delta) * 2.4);
            if (delta > 0.02) {
              // Ganancia de retorno: teal
              out.data[i] = 11 + t * 116;
              out.data[i + 1] = 17 + t * 197;
              out.data[i + 2] = 24 + t * 170;
            } else if (delta < -0.02) {
              // Pérdida: ámbar
              out.data[i] = 24 + t * 218;
              out.data[i + 1] = 24 + t * 158;
              out.data[i + 2] = 28 + t * 81;
            } else {
              out.data[i] = 15;
              out.data[i + 1] = 22;
              out.data[i + 2] = 30;
            }
            out.data[i + 3] = 255;
          }
          const oc = document.createElement("canvas");
          oc.width = oc.height = S;
          oc.getContext("2d")!.putImageData(out, 0, 0);
          ctx.drawImage(oc, 0, 0, S, S, 0, 0, w, h);
        } else {
          // Después completo
          drawCover(ctx, imgAfter, w, h);
          if (mode === "compare") {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w * split, h);
            ctx.clip();
            drawCover(ctx, imgBefore, w, h);
            ctx.restore();
            ctx.fillStyle = "rgba(234,241,245,0.95)";
            ctx.fillRect(w * split - 1, 0, 2, h);
          } else if (mode === "before") {
            drawCover(ctx, imgBefore, w, h);
          }
        }
      })
      .catch(() => alive && setStatus("error"));

    return () => {
      alive = false;
    };
  }, [before, after, mode, split]);

  const setFromClientX = useCallback((clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setSplit(Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, setFromClientX]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="glass px-4 py-2 text-[12px] text-muted-foreground">
            Cargando quicklooks reales desde ASF Earthdata Cloud…
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="glass px-4 py-2 text-[12px]">
            Los quicklooks de estos granules no están disponibles ahora mismo.
          </p>
        </div>
      )}
      {status === "ready" && mode === "compare" && (
        <button
          type="button"
          className="absolute inset-y-0 z-10 w-10 -translate-x-1/2 cursor-ew-resize touch-none bg-transparent"
          style={{ left: `${split * 100}%` }}
          aria-label="Control deslizante de comparación"
          role="slider"
          aria-valuenow={Math.round(split * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            setDragging(true);
            setFromClientX(e.clientX);
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/90" />
          <span
            className={`glass-strong absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/40 transition-transform ${
              dragging ? "scale-110" : "scale-100"
            }`}
          >
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          </span>
        </button>
      )}
    </div>
  );
};

export default RealCompareView;
