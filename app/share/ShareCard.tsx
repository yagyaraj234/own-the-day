import { dailyScores, monthStats, MONTH_NAMES, type SharedMonth } from "@/lib/share";
import { habitHex, stack, type Series } from "@/lib/stack";

// Rendered by next/og (Satori), so layout is flexbox only and every size is explicit.
// `k` scales the whole card: 1 for link previews, 2 for the downloadable image.

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  zinc900: "#18181b", zinc600: "#52525b", zinc500: "#71717a", zinc400: "#a1a1aa",
  zinc300: "#d4d4d8", zinc200: "#e4e4e7", zinc100: "#f4f4f5", zinc50: "#fafafa",
  emerald100: "#d1fae5", emerald500: "#10b981", emerald600: "#059669",
  rose50: "#fff1f2", rose200: "#fecdd3", rose500: "#f43f5e",
};

const PAD = 44;
const HEADER_H = 64;
const GAP = 18;
const FOOTER_H = 22;
const DAYHEAD_H = 26;
const NAME_W = 190;

export default function ShareCard({ shared, host, k = 1 }: { shared: SharedMonth; host: string; k?: number }) {
  const u = (n: number) => n * k;
  const { habits, checks, year, month, days, elapsed, todayDay } = shared;
  const { pct, done, possible } = monthStats(shared);
  const scores = dailyScores(shared);
  const series: Series[] = habits.map((h) => ({
    id: h.id,
    name: h.name,
    done: Array.from({ length: days }, (_, i) => (checks[h.id]?.[i + 1] === 1 ? 1 : 0)),
  }));

  // Grid and chart share the space between header and footer; fewer habits leave a taller chart.
  const body = CARD_H - PAD * 2 - HEADER_H - FOOTER_H - GAP * 3;
  const rowH = Math.floor(Math.min(34, (body - 150 - DAYHEAD_H - 2) / Math.max(habits.length, 1)));
  const gridH = DAYHEAD_H + habits.length * rowH + 2;
  const chartH = body - gridH - 2;
  const cell = (CARD_W - PAD * 2 - 2 - NAME_W) / days;
  const box = Math.min(20, rowH - 8, cell - 6);

  const panel = {
    display: "flex", flexDirection: "column" as const, border: `${u(1)}px solid ${C.zinc200}`,
    borderRadius: u(12),
  };

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff",
        padding: u(PAD), fontFamily: "Geist", color: C.zinc900,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: u(HEADER_H) }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: u(13), fontWeight: 500, letterSpacing: u(1.5), color: C.zinc400 }}>OWN THE DAY</div>
          <div style={{ fontSize: u(38), fontWeight: 600, letterSpacing: u(-0.8), lineHeight: 1.15 }}>
            {`${MONTH_NAMES[month]} ${year}`}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: u(14), color: C.zinc500 }}>{`${done} of ${possible} checks`}</div>
          <div style={{ fontSize: u(38), fontWeight: 600, lineHeight: 1.15, color: pct === null ? C.zinc300 : C.emerald600 }}>
            {pct === null ? "—" : `${pct}%`}
          </div>
        </div>
      </div>

      {/* Habit grid */}
      <div style={{ ...panel, marginTop: u(GAP), height: u(gridH) }}>
        <div style={{ display: "flex", height: u(DAYHEAD_H), borderBottom: `${u(1)}px solid ${C.zinc200}` }}>
          <div style={{ display: "flex", alignItems: "center", width: u(NAME_W), paddingLeft: u(14), fontSize: u(10), fontWeight: 500, letterSpacing: u(1), color: C.zinc500, borderRight: `${u(1)}px solid ${C.zinc200}` }}>
            HABIT
          </div>
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const wd = new Date(year, month, d).getDay();
            const isToday = d === todayDay;
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(cell) }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", width: u(20), height: u(20),
                    borderRadius: u(10), fontSize: u(10), background: isToday ? C.zinc900 : "transparent",
                    color: isToday ? "#ffffff" : wd === 0 || wd === 6 ? C.zinc400 : C.zinc600,
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {String(d)}
                </div>
              </div>
            );
          })}
        </div>

        {habits.map((habit, r) => {
          const marks = checks[habit.id] ?? {};
          return (
            <div key={habit.id} style={{ display: "flex", height: u(rowH), borderTop: r ? `${u(1)}px solid ${C.zinc100}` : "none" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", width: u(NAME_W), paddingLeft: u(14), paddingRight: u(10),
                  fontSize: u(Math.min(14, rowH - 6)), fontWeight: 500, borderRight: `${u(1)}px solid ${C.zinc200}`,
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}
              >
                {/* Keys each habit to its band in the area chart, which can't name the thin ones. */}
                <div style={{ width: u(8), height: u(8), borderRadius: u(2), background: habitHex(r), marginRight: u(8), flexShrink: 0 }} />
                <div style={{ display: "flex", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {habit.name.trim() || `Habit ${r + 1}`}
                </div>
              </div>
              {Array.from({ length: days }, (_, i) => {
                const d = i + 1;
                const mark = marks[d];
                const link = (side: "left" | "right") => (
                  <div style={{ position: "absolute", [side]: 0, top: u(rowH / 2 - 3), width: u(cell / 2), height: u(6), background: C.emerald100 }} />
                );
                return (
                  <div
                    key={d}
                    style={{
                      position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                      width: u(cell), background: d === todayDay ? C.zinc50 : "transparent",
                    }}
                  >
                    {mark === 1 && marks[d - 1] === 1 && link("left")}
                    {mark === 1 && marks[d + 1] === 1 && link("right")}
                    <Box mark={mark} future={d > elapsed} size={u(box)} k={k} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Daily score, the app's stacked area with its columns aligned to the grid's days */}
      <div style={{ ...panel, flexDirection: "row", marginTop: u(GAP), height: u(chartH + 2) }}>
        <ScoreArea scores={scores} series={series} elapsed={elapsed} max={habits.length} cell={cell} height={chartH} k={k} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: u(GAP), height: u(FOOTER_H), fontSize: u(15) }}>
        <div style={{ color: C.zinc500 }}>Track your habits, one box a day</div>
        <div style={{ fontWeight: 600 }}>{host}</div>
      </div>
    </div>
  );
}

const AXIS_H = 24;

// Fills the chart's name column with a summary of the month, clear of the y-axis numbers.
function ScoreStats({ scores, max, height, k }: { scores: number[]; max: number; height: number; k: number }) {
  const u = (n: number) => n * k;
  const total = scores.reduce((a, b) => a + b, 0);
  let streak = 0, run = 0;
  for (const v of scores) {
    run = v > 0 ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const rows: [string, string][] = [
    ["Avg per day", scores.length ? `${(total / scores.length).toFixed(1)}/${max}` : "—"],
    ["Best day", `${Math.max(0, ...scores)}/${max}`],
    ["Perfect days", String(max ? scores.filter((v) => v === max).length : 0)],
    ["Best streak", `${streak} ${streak === 1 ? "day" : "days"}`],
  ];
  // Drop rows rather than overflow when many habits leave the chart short.
  const fit = Math.max(1, Math.min(rows.length, Math.floor((height - 26) / 21)));

  return (
    <div
      style={{
        position: "absolute", left: u(14), top: 0, width: u(NAME_W - 14 - 40), height: u(height),
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}
    >
      <div style={{ fontSize: u(10), fontWeight: 500, letterSpacing: u(1), color: C.zinc500, marginBottom: u(6) }}>
        DAILY SCORE
      </div>
      {rows.slice(0, fit).map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: u(21) }}>
          <div style={{ fontSize: u(12), color: C.zinc500 }}>{label}</div>
          <div style={{ fontSize: u(13), fontWeight: 600, color: C.zinc900 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreArea({ scores, series, elapsed, max, cell, height, k }: {
  scores: number[]; series: Series[]; elapsed: number; max: number; cell: number; height: number; k: number;
}) {
  const u = (n: number) => n * k;
  const top = 14;
  const plot = height - top - AXIS_H;
  const w = cell * scores.length;
  const ymax = Math.max(max, 1);
  const y = (v: number) => top + plot - (v / ymax) * plot;
  const x = (day: number) => cell * (day - 0.5);
  const { layers, labels } = elapsed > 0
    ? stack(series, elapsed, cell, x, y, plot / ymax)
    : { layers: [], labels: [] };
  // Label every score like the app does, thinning out only when rows would crowd.
  const step = plot / ymax < 14 ? 2 : 1;
  const ticks = Array.from({ length: ymax + 1 }, (_, v) => v);
  const label = { position: "absolute" as const, fontSize: u(10), color: C.zinc400, lineHeight: 1 };

  return (
    <>
      {/* Y-axis numbers sit at the right edge of the name column, next to the plot. */}
      <div style={{ position: "relative", display: "flex", width: u(NAME_W), height: u(height) }}>
        <ScoreStats scores={scores.slice(0, elapsed)} max={max} height={height - AXIS_H} k={k} />
        {ticks.filter((v) => v % step === 0).map((v) => (
          <div key={v} style={{ ...label, right: u(10), top: u(y(v) - 5) }}>{String(v)}</div>
        ))}
      </div>
      <div style={{ position: "relative", display: "flex", width: u(w), height: u(height) }}>
        <svg width={u(w)} height={u(height)} viewBox={`0 0 ${w} ${height}`}>
          {ticks.map((v) => (
            <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={C.zinc100} strokeWidth={1} />
          ))}
          {layers.map(({ s, d, color }) => (
            <path key={s.id} d={d} fill={habitHex(color)} stroke="#ffffff" strokeWidth={0.75} strokeLinejoin="round" />
          ))}
        </svg>
        {/* Satori draws no SVG text, so band names are positioned over the plot instead. */}
        {labels.map((l) => (
          <div
            key={l.id}
            style={{
              position: "absolute", left: u(l.x - 150), top: u(l.y - 6), width: u(300), height: u(12),
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: u(10.5), fontWeight: 600,
              letterSpacing: u(0.4), color: "#ffffff", lineHeight: 1, whiteSpace: "nowrap",
            }}
          >
            {l.text}
          </div>
        ))}
        {scores.map((_, i) => (
          <div
            key={i}
            style={{ ...label, left: u(cell * i), top: u(height - AXIS_H + 8), width: u(cell), display: "flex", justifyContent: "center" }}
          >
            {String(i + 1)}
          </div>
        ))}
      </div>
    </>
  );
}

function Box({ mark, future, size, k }: { mark?: 1 | 2; future: boolean; size: number; k: number }) {
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", width: Math.round(size), height: Math.round(size),
    borderRadius: size * 0.27, flexShrink: 0,
  };
  // Marks are drawn with borders and rotated bars rather than an SVG per box: Satori rasterizes
  // every SVG separately, which made a full month take seconds. Everything is placed absolutely
  // from the box's inner size so the marks stay centered at any row height.
  // Whole pixels throughout: Satori misplaces rotated elements at fractional offsets.
  const inner = Math.round(size) - 2 * k;
  const px = (n: number) => Math.round(n);
  if (mark === 1) {
    const w = px(size * 0.24), h = px(size * 0.46), t = px(Math.max(size * 0.11, 1.5 * k));
    return (
      <div style={{ ...base, position: "relative", background: C.emerald500, border: `${k}px solid ${C.emerald600}` }}>
        <div
          style={{
            position: "absolute", left: px((inner - w) / 2), top: px((inner - h) / 2 - size * 0.06), width: w, height: h,
            borderRight: `${t}px solid #ffffff`, borderBottom: `${t}px solid #ffffff`, transform: "rotate(45deg)",
          }}
        />
      </div>
    );
  }
  if (mark === 2) {
    // A text "×" rather than two rotated bars, which Satori misplaces inside the grid.
    return (
      <div
        style={{
          ...base, background: C.rose50, border: `${k}px solid ${C.rose200}`, color: C.rose500,
          fontSize: px(size * 0.95), fontWeight: 500, lineHeight: 1, paddingBottom: px(size * 0.08),
        }}
      >
        ×
      </div>
    );
  }
  if (future) return <div style={{ ...base, border: `${k}px dashed ${C.zinc200}` }} />;
  return <div style={{ ...base, background: "#ffffff", border: `${k}px solid ${C.zinc300}` }} />;
}
