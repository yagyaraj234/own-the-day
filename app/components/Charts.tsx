"use client";

import { useState } from "react";
import ScoreGraph from "./ScoreGraph";

const TYPES = ["Line", "Bars", "Habits", "Year"] as const;
type ChartType = (typeof TYPES)[number];

export default function Charts({
  days,
  scores,
  max,
  elapsed,
  habits,
  yearly,
}: {
  days: number;
  scores: number[];
  max: number;
  elapsed: number;
  habits: { id: string; name: string; done: number }[];
  yearly: { label: string; pct: number | null; current: boolean }[];
}) {
  const [type, setType] = useState<ChartType>("Line");

  return (
    // Takes the height left under the grid, within limits, so the page fills the screen unscaled.
    <section className="mt-6 flex max-h-111 flex-1 flex-col short:mt-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm text-zinc-500">
          {type === "Habits" ? "Per habit" : type === "Year" ? "This year" : "Daily score"}
        </h2>
        <div role="tablist" className="flex rounded-lg bg-zinc-100 p-0.5 text-sm">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                type === t ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-56 flex-1 flex-col rounded-xl border border-zinc-200 short:min-h-48">
        {(type === "Line" || type === "Bars") && (
          <div className="relative my-4 flex-1">
            {/* Left gutter matches the grid's number + habit columns (w-8 + w-28 / lg:w-36 / xl:w-44). */}
            <div className="absolute inset-y-0 left-36 right-0 lg:left-44 xl:left-52">
              <ScoreGraph
                days={days}
                scores={scores}
                max={max}
                elapsed={elapsed}
                variant={type === "Line" ? "line" : "bar"}
              />
              {elapsed === 0 && (
                <p className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
                  This month hasn&apos;t started yet.
                </p>
              )}
            </div>
          </div>
        )}

        {type === "Habits" && (
          // Two columns past six habits, so the list fits the chart's height without scrolling.
          <ul
            style={habits.length > 6 ? { gridTemplateRows: `repeat(${Math.ceil(habits.length / 2)}, auto)` } : undefined}
            className={`grid flex-1 content-center gap-x-10 gap-y-3 p-5 short:gap-y-2 short:p-4 ${habits.length > 6 ? "grid-flow-col grid-cols-2" : ""}`}
          >
            {habits.map((h, i) => {
              const pct = elapsed ? Math.round((h.done / elapsed) * 100) : 0;
              return (
                <li key={h.id} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm xl:grid-cols-[10rem_1fr_3rem]">
                  <span className="truncate text-zinc-700">{h.name.trim() || `Habit ${i + 1}`}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <span className="block h-full rounded-full bg-zinc-900" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-zinc-500">{pct}%</span>
                </li>
              );
            })}
          </ul>
        )}

        {type === "Year" && (
          <div className="flex flex-1 gap-2 p-5 short:p-4">
            {yearly.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs tabular-nums text-zinc-500">{m.pct === null ? "" : `${m.pct}%`}</span>
                <div className="relative w-full flex-1">
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t ${m.current ? "bg-zinc-900" : "bg-zinc-300"}`}
                    style={{ height: `${m.pct ?? 0}%` }}
                  />
                </div>
                <span className={`text-xs ${m.current ? "font-medium text-zinc-900" : "text-zinc-400"}`}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
