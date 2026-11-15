import { useMemo } from "react";
import { formatDate, formatTime } from "@/lib/asf/client";
import type { NisarGranule } from "@/lib/asf/client";

interface SeriesPanelProps {
  granules: NisarGranule[];
  areaLabel: string;
  maxResults: number;
}

interface Stats {
  total: number;
  first: NisarGranule;
  last: NisarGranule;
  medianRevisit: number;
  ascending: number;
  descending: number;
  tracks: { key: string; dir: string; count: number }[];
  months: { label: string; year: number; count: number }[];
  truncated: boolean;
}

function computeStats(all: NisarGranule[], maxResults: number): Stats | null {
  if (all.length === 0) return null;
  const sorted = [...all].sort(
    (a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime(),
  );

  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(
      (new Date(sorted[i].stopTime).getTime() -
        new Date(sorted[i - 1].stopTime).getTime()) /
        86_400_000,
    );
  }
  diffs.sort((a, b) => a - b);
  const medianRevisit =
    diffs.length > 0
      ? diffs[Math.floor(diffs.length / 2)]
      : Number.NaN;

  const trackMap = new Map<string, { dir: string; count: number }>();
  let ascending = 0;
  let descending = 0;
  sorted.forEach((g) => {
    if (g.flightDirection === "ASCENDING") ascending++;
    else descending++;
    const key = `p${g.pathNumber} f${g.frameNumber}`;
    const entry = trackMap.get(key);
    if (entry) entry.count++;
    else trackMap.set(key, { dir: g.flightDirection, count: 1 });
  });

  // Histograma mensual contiguo desde el primer al último mes
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  const counts = new Map<string, number>();
  sorted.forEach((g) => {
    const k = monthKey(new Date(g.stopTime));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const monthFmt = new Intl.DateTimeFormat("es-HN", { month: "short" });
  const months: { label: string; year: number; count: number }[] = [];
  const cursor = new Date(new Date(sorted[0].stopTime));
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(new Date(sorted[sorted.length - 1].stopTime));
  end.setUTCDate(1);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end && months.length <= 36) {
    const k = monthKey(cursor);
    months.push({
      label: monthFmt.format(cursor).replace(".", ""),
      year: cursor.getUTCFullYear(),
      count: counts.get(k) ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return {
    total: sorted.length,
    first: sorted[0],
    last: sorted[sorted.length - 1],
    medianRevisit,
    ascending,
    descending,
    tracks: [...trackMap.entries()]
      .map(([key, v]) => ({ key, dir: v.dir, count: v.count }))
      .sort((a, b) => b.count - a.count),
    months,
    truncated: sorted.length >= maxResults,
  };
}

const W = 860;
const H = 236;
const PAD = 14;

/** Serie temporal real de adquisiciones NISAR que intersectan el área. */
export function SeriesPanel({ granules, areaLabel, maxResults }: SeriesPanelProps) {
  const stats = useMemo(
    () => computeStats(granules, maxResults),
    [granules, maxResults],
  );
  const sortedAsc = useMemo(
    () =>
      [...granules].sort(
        (a, b) =>
          new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime(),
      ),
    [granules],
  );

  if (!stats) {
    return (
      <div className="glass-strong rise-in pointer-events-auto mx-auto w-full max-w-4xl p-5">
        <p className="text-sm font-semibold">
          Sin adquisiciones en {areaLabel}.
        </p>
      </div>
    );
  }

  const t0 = new Date(
    Date.UTC(
      new Date(stats.first.stopTime).getUTCFullYear(),
      new Date(stats.first.stopTime).getUTCMonth(),
      1,
    ),
  ).getTime();
  const t1 = new Date(
    Date.UTC(
      new Date(stats.last.stopTime).getUTCFullYear(),
      new Date(stats.last.stopTime).getUTCMonth() + 1,
      1,
    ),
  ).getTime();
  const x = (t: number) =>
    PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * PAD);
  const plotW = W - 2 * PAD;
  const maxMonth = Math.max(...stats.months.map((m) => m.count), 1);
  const barW = plotW / stats.months.length;
  const stripY = 168;
  const tickH = 26;

  return (
    <div className="glass-strong rise-in pointer-events-auto mx-auto w-full max-w-5xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Serie temporal · {areaLabel}
        </p>
        {stats.truncated && (
          <p className="text-[10px] text-warning">
            Serie truncada a {maxResults} granules (los más recientes)
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Adquisiciones", value: String(stats.total) },
          { label: "Primera", value: formatDate(stats.first.stopTime) },
          { label: "Última", value: formatDate(stats.last.stopTime) },
          {
            label: "Revisita mediana",
            value:
              Number.isFinite(stats.medianRevisit) && stats.medianRevisit >= 1
                ? `${Math.round(stats.medianRevisit)} días`
                : "< 1 día",
          },
          { label: "Pasadas asc.", value: String(stats.ascending) },
          { label: "Pasadas desc.", value: String(stats.descending) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-0.5 font-mono-data text-[13px] font-semibold text-foreground">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label="Histograma mensual y cronología de adquisiciones NISAR"
      >
        {stats.months.map((m, i) => {
          const h = (m.count / maxMonth) * 96;
          const bx = PAD + i * barW;
          return (
            <g key={`${m.year}-${i}`}>
              <rect
                x={bx + barW * 0.18}
                y={130 - h}
                width={barW * 0.64}
                height={h}
                rx={2.5}
                fill="rgba(127,214,194,0.55)"
              />
              {m.count > 0 && (
                <text
                  x={bx + barW / 2}
                  y={130 - h - 5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="rgba(234,241,245,0.75)"
                >
                  {m.count}
                </text>
              )}
            </g>
          );
        })}
        {stats.months.map((m, i) => {
          const every = Math.ceil(stats.months.length / 12);
          if (i % every !== 0) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={PAD + i * barW + barW / 2}
              y={216}
              textAnchor="middle"
              fontSize="9.5"
              fill="rgba(143,162,176,0.8)"
            >
              {m.label}
              {m.label === "ene" || i === 0 ? ` ${String(m.year).slice(2)}` : ""}
            </text>
          );
        })}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={130}
          y2={130}
          stroke="rgba(234,241,245,0.25)"
          strokeWidth={1}
        />
        <text
          x={PAD}
          y={14}
          fontSize="9.5"
          fill="rgba(143,162,176,0.8)"
        >
          ADQUISICIONES/MES · MÁX {maxMonth}
        </text>

        {sortedAsc.map((g) => {
          const t = new Date(g.stopTime).getTime();
          const asc = g.flightDirection === "ASCENDING";
          return (
            <line
              key={g.fileID}
              x1={x(t)}
              x2={x(t)}
              y1={stripY - tickH}
              y2={stripY}
              stroke={asc ? "#7FD6C2" : "#F2B66D"}
              strokeWidth={1.6}
            >
              <title>
                {formatDate(g.stopTime)} {formatTime(g.stopTime)} ·{" "}
                {asc ? "Ascendente" : "Descendente"} · p{g.pathNumber} f
                {g.frameNumber}
              </title>
            </line>
          );
        })}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={stripY}
          y2={stripY}
          stroke="rgba(234,241,245,0.25)"
          strokeWidth={1}
        />
        <g fontSize="9.5">
          <line
            x1={W - PAD - 190}
            x2={W - PAD - 178}
            y1={stripY + 14}
            y2={stripY + 14}
            stroke="#7FD6C2"
            strokeWidth={1.6}
          />
          <text x={W - PAD - 172} y={stripY + 17} fill="rgba(143,162,176,0.9)">
            ASCENDENTE
          </text>
          <line
            x1={W - PAD - 104}
            x2={W - PAD - 92}
            y1={stripY + 14}
            y2={stripY + 14}
            stroke="#F2B66D"
            strokeWidth={1.6}
          />
          <text x={W - PAD - 86} y={stripY + 17} fill="rgba(143,162,176,0.9)">
            DESCENDENTE
          </text>
        </g>
      </svg>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cobertura por pista/marco
          </p>
          <ul className="mt-2 space-y-1.5">
            {stats.tracks.slice(0, 6).map((t) => (
              <li
                key={t.key}
                className="flex items-center justify-between font-mono-data text-[11px]"
              >
                <span className="text-foreground">
                  {t.key} · {t.dir === "ASCENDING" ? "Asc" : "Desc"}
                </span>
                <span className="text-primary">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Adquisiciones (cronológico · {sortedAsc.length})
          </p>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
            {sortedAsc.map((g) => (
              <li
                key={g.fileID}
                className="flex items-center justify-between gap-2 font-mono-data text-[11px]"
              >
                <span className="text-foreground">
                  {formatDate(g.stopTime)} ·{" "}
                  {g.flightDirection === "ASCENDING" ? "Asc" : "Desc"} · p
                  {g.pathNumber} f{g.frameNumber}
                </span>
                <a
                  href={`https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=${g.fileID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-primary hover:underline"
                  title={`Abrir ${g.sceneName} en ASF Vertex`}
                >
                  ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
