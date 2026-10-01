"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Drawn at the container's real pixel size, so it can take whatever height the page has left and
// text stays 11px. The plot spans exactly the grid's day columns, so each day lines up with its
// column above; y-axis labels hang off the left edge into the gutter (overflow visible).
const PAD = { t: 8, b: 24 };

export type Variant = "line" | "area" | "bar";

export interface Series {
  id: string;
  name: string;
  done: number[]; // 1 if done that day, index 0 = day 1
}

// A distinct hue per habit for the stacked area, ordered so neighbouring layers never sit close on
// the wheel. Mid lightness keeps white labels readable on both white and zinc-950.
const HUES = [255, 55, 175, 15, 300, 85, 145, 330, 210, 35, 275, 115];
export function habitColor(i: number) {
  return `oklch(0.62 0.13 ${HUES[i % HUES.length]})`;
}

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

// Samples per day column, for drawing the bands as smooth curves.
const SUB = 8;
// Binomial kernel: each habit's band is smoothed over the two days either side, so the area reads
// as a habit's rhythm rather than a row of on/off spikes. Exact counts stay in Line and Bars.
const KERNEL = [1, 4, 6, 4, 1];
// Rough width of one 11px semibold uppercase glyph, and the room a label needs inside its band.
const CHAR_W = 7.4;
const LABEL_H = 13;

function smooth(v: number[]) {
  return v.map((_, j) => {
    let sum = 0, weight = 0;
    KERNEL.forEach((k, o) => {
      const d = j + o - 2;
      if (d >= 0 && d < v.length) { sum += k * v[d]; weight += k; }
    });
    return sum / weight;
  });
}

// Catmull-Rom through the day values; clamped at zero, since a curve can dip a little below a
// zero day and a band must never have negative thickness.
function curveAt(v: number[], t: number) {
  const n = v.length;
  const j = Math.max(0, Math.min(n - 1, Math.floor(t)));
  if (j >= n - 1) return v[n - 1];
  const p0 = v[Math.max(j - 1, 0)], p1 = v[j], p2 = v[j + 1], p3 = v[Math.min(j + 2, n - 1)];
  const u = t - j;
  const c = 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
  return Math.max(c, 0);
}

function stack(
  series: Series[], elapsed: number, colW: number,
  x: (day: number) => number, y: (v: number) => number, unitH: number,
) {
  // Sample positions in fractional day indexes (0 = day 1). A single plotted day gets a little
  // width so its band doesn't collapse to nothing.
  const ts: number[] = [];
  if (elapsed === 1) ts.push(-0.3, 0.3);
  else for (let j = 0; j < elapsed - 1; j++) for (let k = 0; k < SUB; k++) ts.push(j + k / SUB);
  if (elapsed > 1) ts.push(elapsed - 1);
  const px = ts.map((t) => x(t + 1));
  const step = px.length > 1 ? px[1] - px[0] : colW;

  // Steadiest habits at the bottom, so the base of the stack stays calm. Colours follow the
  // habit's position in the grid, not the stack, so they match the legend and stay put.
  const order = series
    .map((s, i) => ({ s, i, done: s.done.slice(0, elapsed).map((v) => v ?? 0) }))
    .map((h) => ({ ...h, total: h.done.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.i - b.i);

  const layers: { s: Series; d: string; color: number }[] = [];
  const labels: { id: string; x: number; y: number; text: string }[] = [];
  const unlabeled: string[] = [];
  let belowS = ts.map(() => 0);

  for (const { s, i, done, total } of order) {
    if (!total) continue; // nothing done this month: no band, no legend entry
    const sm = smooth(done);
    const topS = belowS.map((b, k) => b + (elapsed === 1 ? sm[0] : curveAt(sm, ts[k])));
    const up = px.map((p, k) => `${k ? "L" : "M"}${p},${y(topS[k])}`).join(" ");
    const down = px.map((p, k) => `L${p},${y(belowS[k])}`).reverse().join(" ");
    layers.push({ s, d: `${up} ${down} Z`, color: i });

    // Label: find the widest horizontal strip, LABEL_H tall, that fits inside the band. Grow a
    // window out from each sample while the band's lowest top and highest bottom leave room.
    const name = (s.name.trim() || `Habit ${i + 1}`).toUpperCase();
    const want = name.length * CHAR_W + 10;
    let best = { c: -1, h: 0, y: 0 };
    if (unitH >= LABEL_H) {
      for (let c = 0; c < px.length; c++) {
        let hi = y(topS[c]), lo = y(belowS[c]);
        if (lo - hi < LABEL_H) continue;
        let h = 0;
        while (h * 2 * step < want && c - h - 1 >= 0 && c + h + 1 < px.length) {
          const nHi = Math.max(hi, y(topS[c - h - 1]), y(topS[c + h + 1]));
          const nLo = Math.min(lo, y(belowS[c - h - 1]), y(belowS[c + h + 1]));
          if (nLo - nHi < LABEL_H) break;
          hi = nHi; lo = nLo; h++;
        }
        if (h > best.h) best = { c, h, y: (hi + lo) / 2 };
      }
    }
    const fit = Math.floor((best.h * 2 * step - 10) / CHAR_W);
    if (best.c >= 0 && fit >= Math.min(name.length, 4)) {
      labels.push({ id: s.id, x: px[best.c], y: best.y, text: name.length > fit ? `${name.slice(0, fit - 1)}…` : name });
    } else {
      unlabeled.push(s.id);
    }
    belowS = topS;
  }

  return { layers, labels, unlabeled };
}
