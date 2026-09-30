"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Drawn at the container's real pixel size, so it can take whatever height the page has left and
// text stays 11px. The plot spans exactly the grid's day columns, so each day lines up with its
// column above; y-axis labels hang off the left edge into the gutter (overflow visible).
const PAD = { t: 8, b: 24 };

export default function ScoreGraph({
  days,
  scores,
  max,
  elapsed,
  variant,
}: {
  days: number;
  scores: number[]; // index 0 = day 1
  max: number;
  elapsed: number; // days that can be plotted
  variant: "line" | "bar";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="absolute inset-0">
      {size && <Plot {...size} days={days} scores={scores} max={max} elapsed={elapsed} variant={variant} />}
    </div>
  );
}

function Plot({
  w: W, h: H, days, scores, max, elapsed, variant,
}: {
  w: number; h: number; days: number; scores: number[]; max: number; elapsed: number; variant: "line" | "bar";
}) {
  const plotH = H - PAD.t - PAD.b;
  const colW = W / days;
  const x = (day: number) => (day - 0.5) * colW;
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  // Skip every other y label when rows get too tight to read.
  const yStep = plotH / max < 14 ? 2 : 1;

  const points = scores.slice(0, elapsed).map((v, i) => [x(i + 1), y(v)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="block overflow-visible"
      role="img"
      aria-label="Daily habits score graph"
    >
      {Array.from({ length: max + 1 }, (_, v) => (
        <g key={`y${v}`}>
          <line x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-zinc-100" />
          {v % yStep === 0 && (
            <text x={-8} y={y(v)} dy="0.35em" textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums">
              {v}
            </text>
          )}
        </g>
      ))}
      {Array.from({ length: days }, (_, i) => (
        <text key={`d${i}`} x={x(i + 1)} y={H - 6} textAnchor="middle" className="fill-zinc-400 text-[11px] tabular-nums">
          {i + 1}
        </text>
      ))}

      {variant === "bar" &&
        scores.slice(0, elapsed).map((v, i) => (
          <rect
            key={`b${i}`}
            x={x(i + 1) - colW * 0.3}
            y={y(v)}
            width={colW * 0.6}
            height={y(0) - y(v)}
            rx={2}
            className="fill-zinc-900"
          >
            <title>{`Day ${i + 1}: ${v}/${max}`}</title>
          </rect>
        ))}

      {variant === "line" && line && (
        <path d={line} fill="none" className="stroke-zinc-900" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {variant === "line" && points.map(([px, py], i) => (
        <circle key={`p${i}`} cx={px} cy={py} r={3} className="fill-zinc-900">
          <title>{`Day ${i + 1}: ${scores[i]}/${max}`}</title>
        </circle>
      ))}
    </svg>
  );
}
