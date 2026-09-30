const W = 960;
const H = 260;
const PAD = { l: 28, r: 8, t: 10, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

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
  const colW = PLOT_W / days;
  const x = (day: number) => PAD.l + (day - 0.5) * colW;
  const y = (v: number) => PAD.t + PLOT_H - (v / max) * PLOT_H;

  const points = scores.slice(0, elapsed).map((v, i) => [x(i + 1), y(v)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full min-w-[640px]"
        role="img"
        aria-label="Daily habits score graph"
      >
        {Array.from({ length: max + 1 }, (_, v) => (
          <g key={`y${v}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-zinc-100" />
            <text x={PAD.l - 8} y={y(v)} dy="0.35em" textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: days }, (_, i) => (
          <text key={`d${i}`} x={x(i + 1)} y={H - 8} textAnchor="middle" className="fill-zinc-400 text-[11px] tabular-nums">
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
    </div>
  );
}
