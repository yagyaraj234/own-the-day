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
    <section className="mt-12">
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

      <div className="rounded-xl border border-zinc-200 p-3 sm:p-5">
        {(type === "Line" || type === "Bars") && (
          <>
            <ScoreGraph
              days={days}
              scores={scores}
              max={max}
              elapsed={elapsed}
              variant={type === "Line" ? "line" : "bar"}
            />
            {elapsed === 0 && (
              <p className="pb-2 text-center text-sm text-zinc-400">This month hasn&apos;t started yet.</p>
            )}
          </>
        )}

        {type === "Habits" && (
          <ul className="flex flex-col gap-3">
            {habits.map((h, i) => {
              const pct = elapsed ? Math.round((h.done / elapsed) * 100) : 0;
              return (
                <li key={h.id} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_3rem]">
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
          <div className="flex h-56 items-end gap-2">
            {yearly.map((m) => (
              <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs tabular-nums text-zinc-500">{m.pct === null ? "" : `${m.pct}%`}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${m.current ? "bg-zinc-900" : "bg-zinc-300"}`}
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
