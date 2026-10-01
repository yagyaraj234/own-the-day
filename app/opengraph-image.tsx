import { ImageResponse } from "next/og";
import { MARK } from "@/lib/brand";
import { loadGoogleFonts } from "@/lib/og-fonts";

// The site's link preview. Rendered by next/og (Satori), so layout is flexbox only.
// It shows a sample month, not anyone's data: the score line is derived from the grid below.

export const alt = "OwnTheDay: a monthly habit grid with a daily score line climbing to 87%";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  ink: "#09090b", zinc900: "#18181b", zinc600: "#52525b", zinc500: "#71717a", zinc400: "#a1a1aa",
  zinc300: "#d4d4d8", zinc200: "#e4e4e7", zinc100: "#f4f4f5", zinc50: "#fafafa",
};

const HABITS: [string, string][] = [
  ["Wake 6am", "1001110111011101101111111111111"],
  ["Workout", "0001010010000000011100010111111"],
  ["Read 20 pages", "0101111011111111111111001101111"],
  ["No sugar", "0000111110010100110000100010010"],
  ["Meditate", "0110000101101001110111111110111"],
  ["Journal", "0010000111111000010010111101011"],
  ["Water 3L", "1011000011010111111110111111111"],
  ["Sleep by 11", "0110011011011111111100111111111"],
];
const DAYS = 31;
const scores = Array.from({ length: DAYS }, (_, d) => {
  const done = HABITS.filter(([, row]) => row[d] === "1").length;
  return Math.floor((done / HABITS.length) * 100);
});
const today = HABITS.filter(([, row]) => row[DAYS - 1] === "1").length;
const avg = Math.round(scores.reduce((a, b) => a + b, 0) / DAYS);

const LABEL_W = 100;
const CELL = 13;
const GAP = 2;
const GRID_W = DAYS * CELL + (DAYS - 1) * GAP;
const PLOT_H = 150;

const mono = "Geist Mono";

export default async function Image() {
  const fonts = [
    ...(await loadGoogleFonts("Geist", [400, 500, 600])),
    ...(await loadGoogleFonts("Geist Mono", [400, 500])),
  ];

  const pts = scores.map((s, i) => [6.5 + i * (CELL + GAP), PLOT_H - (s / 100) * PLOT_H] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const [lastX, lastY] = pts[pts.length - 1];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", position: "relative", background: C.zinc50,
          color: C.ink, fontFamily: "Geist",
        }}
      >
        {/* Left: brand, headline, today's score */}
        <div style={{ position: "absolute", left: 72, top: 72, width: 430, height: 486, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>
            <div style={{ display: "flex", flexWrap: "wrap", width: 26, height: 26, gap: 4, marginRight: 12 }}>
              {MARK.map((on, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: on ? C.ink : C.zinc300 }} />
              ))}
            </div>
            OwnTheDay
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 64, fontSize: 46, lineHeight: 1.04, fontWeight: 600, letterSpacing: -2 }}>
            <div>Tick the day.</div>
            <div style={{ color: C.zinc400 }}>Watch the line climb.</div>
          </div>
          <div style={{ position: "absolute", left: 0, bottom: 0, display: "flex", alignItems: "flex-end" }}>
            <div style={{ fontFamily: mono, fontSize: 96, lineHeight: 0.8, fontWeight: 500, letterSpacing: -5 }}>
              {`${scores[DAYS - 1]}%`}
            </div>
            <div
              style={{
                display: "flex", flexDirection: "column", marginLeft: 18, fontFamily: mono, fontSize: 14,
                color: C.zinc500, lineHeight: 1.5, letterSpacing: 1,
              }}
            >
              <div>{"TODAY'S SCORE"}</div>
              <div>{`${today} OF ${HABITS.length} HABITS`}</div>
            </div>
          </div>
        </div>

        {/* Right: the tracker panel */}
        <div
          style={{
            position: "absolute", right: 60, top: 60, width: 620, height: 510, padding: 24, display: "flex",
            flexDirection: "column", background: "#ffffff", border: `1px solid ${C.zinc200}`, borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            <div>This month</div>
            <div style={{ fontFamily: mono, fontWeight: 400, fontSize: 13, color: C.zinc500 }}>{`avg ${avg}% · ${DAYS} days`}</div>
          </div>

          {HABITS.map(([name, row]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", height: 15, marginBottom: 5 }}>
              <div style={{ width: LABEL_W, fontSize: 12, color: C.zinc600 }}>{name}</div>
              <div style={{ display: "flex", gap: GAP }}>
                {[...row].map((v, d) => (
                  <div
                    key={d}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      background: v === "1" ? C.zinc900 : C.zinc100,
                      border: v === "1" ? "none" : `1px solid ${C.zinc200}`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: GAP, marginTop: 6, marginLeft: LABEL_W }}>
            {Array.from({ length: DAYS }, (_, d) => (
              <div key={d} style={{ width: CELL, fontFamily: mono, fontSize: 9, color: C.zinc400 }}>
                {d % 7 === 0 ? String(d + 1) : ""}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex", justifyContent: "space-between", width: GRID_W, marginTop: 18, marginBottom: 6,
              marginLeft: LABEL_W, fontFamily: mono, fontSize: 11, color: C.zinc500,
            }}
          >
            <div>Daily score</div>
            <div>100</div>
          </div>
          <svg width={GRID_W} height={PLOT_H + 12} viewBox={`0 -6 ${GRID_W} ${PLOT_H + 12}`} style={{ marginLeft: LABEL_W }}>
            <line x1="0" y1="0" x2={GRID_W} y2="0" stroke={C.zinc200} strokeWidth="1" />
            <line x1="0" y1={PLOT_H / 2} x2={GRID_W} y2={PLOT_H / 2} stroke={C.zinc200} strokeWidth="1" />
            <line x1="0" y1={PLOT_H} x2={GRID_W} y2={PLOT_H} stroke={C.zinc300} strokeWidth="1" />
            <path d={`${line} L${lastX},${PLOT_H} L${pts[0][0]},${PLOT_H} Z`} fill={C.ink} fillOpacity="0.06" />
            <path d={line} fill="none" stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r="4.5" fill={C.ink} />
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
