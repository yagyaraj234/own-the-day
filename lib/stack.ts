// The stacked-area layout, shared by the app's chart and the share card so both draw the same bands.

export interface Series {
  id: string;
  name: string;
  done: number[]; // 1 if done that day, index 0 = day 1
}

// A distinct hue per habit for the stacked area, ordered so neighbouring layers never sit close on
// the wheel. Mid lightness keeps white labels readable on both white and zinc-950.
const HUES = [255, 55, 175, 15, 300, 85, 145, 330, 210, 35, 275, 115];
const L = 0.62, C = 0.13;
export function habitColor(i: number) {
  return `oklch(${L} ${C} ${HUES[i % HUES.length]})`;
}

// The same colour as sRGB hex, for the share card: Satori doesn't understand oklch().
export function habitHex(i: number) {
  const h = (HUES[i % HUES.length] * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((v) => {
      const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(Math.max(g, 0), 1) * 255).toString(16).padStart(2, "0");
    })
    .join("")}`;
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

export function stack(
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
