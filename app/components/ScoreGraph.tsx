"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { habitColor, stack, type Series } from "@/lib/stack";

// Drawn at the container's real pixel size, so it can take whatever height the page has left and
// text stays 11px. The plot spans exactly the grid's day columns, so each day lines up with its
// column above; y-axis labels hang off the left edge into the gutter (overflow visible).
const PAD = { t: 8, b: 24 };

export type Variant = "line" | "area" | "bar";

export default function ScoreGraph(props: {
  days: number;
  scores: number[]; // habits done per day, index 0 = day 1
  missed: number[]; // habits marked missed per day, index 0 = day 1
  series: Series[];
  max: number;
  elapsed: number; // days that can be plotted
  variant: Variant;
  onUnlabeled?: (ids: string[]) => void; // area only: habits whose band was too thin to name
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="absolute inset-0">
      {size && <Plot {...size} {...props} />}
    </div>
  );
}

function Plot({
  w: W, h: H, days, scores, missed, series, max, elapsed, variant, onUnlabeled,
}: {
  w: number; h: number; days: number; scores: number[]; missed: number[]; series: Series[];
  max: number; elapsed: number; variant: Variant; onUnlabeled?: (ids: string[]) => void;
}) {
  const plotH = H - PAD.t - PAD.b;
  const colW = W / days;
  const x = (day: number) => (day - 0.5) * colW;
  const y = (v: number) => PAD.t + plotH - (v / Math.max(max, 1)) * plotH;
  // Skip every other y label when rows get too tight to read.
  const yStep = plotH / Math.max(max, 1) < 14 ? 2 : 1;

  const points = scores.slice(0, elapsed).map((v, i) => [x(i + 1), y(v)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");

  const { layers, labels, unlabeled } = variant === "area" && elapsed > 0
    ? stack(series, elapsed, colW, x, y, plotH / Math.max(max, 1))
    : { layers: [], labels: [], unlabeled: [] };
  const unlabeledKey = unlabeled.join(" ");
  useEffect(() => {
    onUnlabeled?.(unlabeledKey ? unlabeledKey.split(" ") : []);
  }, [unlabeledKey, onUnlabeled]);

  const label =
    variant === "line" ? "Habits done per day"
    : variant === "area" ? "Habits done per day, stacked by habit"
    : "Habits done and missed per day";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="block overflow-visible"
      role="img"
      aria-label={label}
    >
      {Array.from({ length: max + 1 }, (_, v) => (
        <g key={`y${v}`}>
          <line x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-zinc-100 dark:stroke-zinc-800" />
          {v % yStep === 0 && (
            <text x={-8} y={y(v)} dy="0.35em" textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500 text-[11px] tabular-nums">
              {v}
            </text>
          )}
        </g>
      ))}
      {Array.from({ length: days }, (_, i) => (
        <text key={`d${i}`} x={x(i + 1)} y={H - 6} textAnchor="middle" className="fill-zinc-400 dark:fill-zinc-500 text-[11px] tabular-nums">
          {i + 1}
        </text>
      ))}

      {variant === "bar" &&
        scores.slice(0, elapsed).map((v, i) => (
          <g key={`b${i}`}>
            <title>{`Day ${i + 1}: ${v} done, ${missed[i]} missed`}</title>
            <rect
              x={x(i + 1) - colW * 0.3}
              y={y(v)}
              width={colW * 0.6}
              height={y(0) - y(v)}
              className="fill-zinc-900 dark:fill-zinc-100"
            />
            {missed[i] > 0 && (
              <rect
                x={x(i + 1) - colW * 0.3}
                y={y(v + missed[i])}
                width={colW * 0.6}
                height={y(v) - y(v + missed[i])}
                className="fill-rose-400 dark:fill-rose-500"
              />
            )}
          </g>
        ))}

      {layers.map(({ s, d, color }) => (
        <path key={s.id} d={d} fill={habitColor(color)} className="stroke-white dark:stroke-zinc-950" strokeWidth={0.75} strokeLinejoin="round">
          <title>{`${s.name.trim() || `Habit ${color + 1}`}: ${s.done.slice(0, elapsed).reduce((a, b) => a + b, 0)} of ${elapsed} days`}</title>
        </path>
      ))}
      {labels.map((l) => (
        <text
          key={`l${l.id}`}
          x={l.x}
          y={l.y}
          dy="0.35em"
          textAnchor="middle"
          className="pointer-events-none fill-white text-[11px] font-semibold uppercase tracking-wide"
        >
          {l.text}
        </text>
      ))}

      {variant === "line" && line && (
        <path d={line} fill="none" className="stroke-zinc-900 dark:stroke-zinc-100" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {variant === "line" && points.map(([px, py], i) => (
        <circle key={`p${i}`} cx={px} cy={py} r={3} className="fill-zinc-900 dark:fill-zinc-100">
          <title>{`Day ${i + 1}: ${scores[i]} of ${max} done`}</title>
        </circle>
      ))}
    </svg>
  );
}
