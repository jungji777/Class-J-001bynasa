import { Plasma } from "@cruxgarden/plasma-ui";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <Plasma
      fuse={false}
      lean={false}
      opacity={0.3}
      frost={0.22}
      className="rise-in pointer-events-auto flex flex-col overflow-hidden"
      style={{ animationDelay: "240ms" }}
    >
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Acercar"
        className="flex h-10 w-10 items-center justify-center text-lg transition-colors hover:bg-white/10"
      >
        +
      </button>
      <div className="h-px bg-white/10" />
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Alejar"
        className="flex h-10 w-10 items-center justify-center text-lg transition-colors hover:bg-white/10"
      >
        −
      </button>
    </Plasma>
  );
}

export function NorthIndicator({ onRecenter }: { onRecenter?: () => void }) {
  return (
    <Plasma
      as="button"
      type="button"
      fuse={false}
      lean={false}
      opacity={0.3}
      frost={0.22}
      className="rise-in pointer-events-auto flex h-10 w-10 items-center justify-center transition-colors hover:bg-white/10"
      style={{ animationDelay: "300ms" }}
      aria-label="Centrar sobre Honduras"
      title="Centrar sobre Honduras"
      onClick={onRecenter}
    >
      <span className="text-sm font-bold text-primary">N</span>
    </Plasma>
  );
}

export function MissionBadge() {
  return (
    <Plasma
      fuse={false}
      lean={false}
      className="rise-in flex items-center gap-2 px-3.5 py-2.5"
      style={{ animationDelay: "360ms" }}
    >
      <div className="leading-tight">
        <p className="text-[11px] font-semibold">NISAR en órbita</p>
        <p className="font-mono-data text-[10px] text-muted-foreground">
          Pasada descendente · banda L · 12 nov
        </p>
      </div>
      <span className="relative ml-1 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
      </span>
    </Plasma>
  );
}

export function CursorChip({ coords }: { coords: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center md:bottom-7">
      <div
        className={`glass font-mono-data flex items-center gap-2 px-3.5 py-1.5 text-[11px] tracking-wide transition-opacity duration-300 ${
          coords ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {coords ?? ""}
      </div>
    </div>
  );
}
