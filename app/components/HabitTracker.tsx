"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getAllMonths, getMonth, onMonthsChanged, putMonths, requestPersistence, updateMonth, type Habit, type Mark, type MonthRecord } from "@/lib/db";
import BackupButton from "./BackupButton";
import Charts from "./Charts";
import ShareButton from "./ShareButton";
import ThemeToggle from "./ThemeToggle";

const MIN_HABITS = 3;
const MAX_HABITS = 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DEFAULT_HABITS: Habit[] = [
  "Chanting", "DSA Question", "Coding", "2L Water", "Book Read", "Walk / Workout",
].map((name, i) => ({ id: `default-${i + 1}`, name }));

// Column highlight is driven by a data attribute on the table, not React state, so moving the
// pointer across days restyles two columns instead of re-rendering every row. Unlayered, so it
// wins over the Tailwind utilities on the cells.
const COLUMN_HOVER_CSS = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  const on = `[data-hover-day="${d}"]`;
  return `${on} [data-col="${d}"]{background:var(--col-hover)}` +
    `${on} [data-col-num="${d}"]:not([data-today]){background:var(--col-num-hover-bg);color:var(--col-num-hover-fg)}`;
}).join("");

const DATE_LABEL = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const NO_MARKS: Record<number, Mark> = {};

type Day = { d: number; weekend: boolean; label: string };

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// How many days of this month can be marked: all of a past month, up to today in the current one.
function elapsedDays(y: number, m: number, today: Date) {
  const ty = today.getFullYear();
  const tm = today.getMonth();
  if (y < ty || (y === ty && m < tm)) return daysIn(y, m);
  if (y === ty && m === tm) return today.getDate();
  return 0;
}

// A month nobody has touched yet starts with the habit list of the latest earlier month.
function blankMonth(key: string, months: Map<string, MonthRecord>): MonthRecord {
  let prev: MonthRecord | undefined;
  for (const r of months.values()) {
    if (r.key < key && (!prev || r.key > prev.key)) prev = r;
  }
  return { key, habits: prev ? prev.habits.map((h) => ({ ...h })) : DEFAULT_HABITS, checks: {} };
}

// A row being dragged by its handle. `mids` are the vertical centers of every row when the drag
// began; comparing the dragged row's center against them picks the drop slot.
// Positions are in the table's own pixels: the page may be scaled to fit the viewport, so screen
// measurements are divided by `scale`.
type Drag = { id: string; from: number; to: number; dy: number; startY: number; mids: number[]; h: number; scale: number };

const rowEls = (tbody: HTMLElement | null) =>
  Array.from(tbody?.querySelectorAll<HTMLElement>("[data-row-id]") ?? []);
const rowTops = (tbody: HTMLElement | null) =>
  new Map(rowEls(tbody).map((el) => [el.dataset.rowId!, el.getBoundingClientRect().top]));
// How much the page is scaled on screen, read off a row's rendered vs. layout height.
const scaleOf = (el: HTMLElement) => el.getBoundingClientRect().height / el.offsetHeight || 1;

// A column moves together through the same cycle as one box, starting from done unless
// every habit already shares a mark.
function nextColumnMark(record: MonthRecord, day: number): Mark | undefined {
  const marks = record.habits.map((h) => record.checks[h.id]?.[day]);
  if (marks.every((m) => m === 1)) return 2;
  if (marks.every((m) => m === 2)) return undefined;
  return 1;
}

function doneCount(record: MonthRecord, habitId: string) {
  return Object.values(record.checks[habitId] ?? {}).filter((v) => v === 1).length;
}

type Loaded = { today: Date; months: Map<string, MonthRecord>; error: string | null };

export default function HabitTracker() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    getAllMonths()
      .then(
        (all) => ({ months: new Map(all.map((r) => [r.key, r])), error: null }),
        () => ({
          months: new Map<string, MonthRecord>(),
          error: "Couldn't open local storage. Your browser may be blocking IndexedDB.",
        }),
      )
      .then((r) => setLoaded({ ...r, today: new Date() }));
  }, []);

  if (!loaded) {
    return <div className="grid flex-1 place-items-center text-sm text-zinc-400 dark:text-zinc-500">Loading…</div>;
  }
  return <Tracker {...loaded} />;
}

// Stable across renders, so memoized rows only re-render when their own data changes.
type RowActions = {
  toggle: (habitId: string, day: number) => void;
  rename: (habitId: string, name: string) => void;
  remove: (habitId: string) => void;
  dragStart: (e: React.PointerEvent<HTMLElement>, row: number) => void;
  dragMove: (e: React.PointerEvent) => void;
  dragEnd: () => void;
  handleKey: (e: React.KeyboardEvent, row: number) => void;
};

function Tracker({ today, months: initialMonths, error: initialError }: Loaded) {
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [months, setMonths] = useState(initialMonths);
  const [error, setError] = useState(initialError);
  const tableRef = useRef<HTMLTableElement>(null);
  const [lastToggled, setLastToggled] = useState<{ key: string; habitId: string | null; day: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Row positions captured just before a reorder commits, so rows can glide from where they were.
  const flipFrom = useRef<Map<string, number> | null>(null);

  const key = monthKey(year, month);
  const record = useMemo(() => months.get(key) ?? blankMonth(key, months), [months, key]);

  const days = daysIn(year, month);
  const elapsed = elapsedDays(year, month, today);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const dayList = useMemo<Day[]>(
    () =>
      Array.from({ length: daysIn(year, month) }, (_, i) => {
        const date = new Date(year, month, i + 1);
        const weekday = date.getDay();
        return { d: i + 1, weekend: weekday === 0 || weekday === 6, label: DATE_LABEL.format(date) };
      }),
    [year, month],
  );

  const scores = useMemo(
    () =>
      Array.from({ length: days }, (_, i) =>
        record.habits.reduce((n, h) => n + (record.checks[h.id]?.[i + 1] === 1 ? 1 : 0), 0),
      ),
    [record, days],
  );
  const missed = useMemo(
    () =>
      Array.from({ length: days }, (_, i) =>
        record.habits.reduce((n, h) => n + (record.checks[h.id]?.[i + 1] === 2 ? 1 : 0), 0),
      ),
    [record, days],
  );
  const series = useMemo(
    () =>
      record.habits.map((h) => ({
        ...h,
        done: Array.from({ length: days }, (_, i) => (record.checks[h.id]?.[i + 1] === 1 ? 1 : 0)),
      })),
    [record, days],
  );
  const yearly = useMemo(
    () =>
      MONTHS.map((label, m) => {
        const r = months.get(monthKey(year, m));
        const possibleM = r ? r.habits.length * elapsedDays(year, m, today) : 0;
        const doneM = r ? r.habits.reduce((n, h) => n + doneCount(r, h.id), 0) : 0;
        return { label, pct: possibleM ? Math.round((doneM / possibleM) * 100) : null, current: m === month };
      }),
    [months, year, month, today],
  );

  const actionsRef = useRef<RowActions>(null);
  const rowActions = useMemo<RowActions>(
    () => ({
      toggle: (id, d) => actionsRef.current!.toggle(id, d),
      rename: (id, name) => actionsRef.current!.rename(id, name),
      remove: (id) => actionsRef.current!.remove(id),
      dragStart: (e, row) => actionsRef.current!.dragStart(e, row),
      dragMove: (e) => actionsRef.current!.dragMove(e),
      dragEnd: () => actionsRef.current!.dragEnd(),
      handleKey: (e, row) => actionsRef.current!.handleKey(e, row),
    }),
    [],
  );

  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const el of rowEls(tbodyRef.current)) {
      const prev = from.get(el.dataset.rowId!);
      if (prev === undefined) continue;
      const dy = (prev - el.getBoundingClientRect().top) / scaleOf(el);
      if (Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration: 200,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      });
    }
  }, [record, drag]);

  // Writes still in flight per month. While any are, the screen is ahead of the database, so a
  // change from another window is noted in `stale` and re-read once the last write lands.
  const pending = useRef(new Map<string, number>());
  const stale = useRef(new Set<string>());

  const refresh = (k: string) => {
    getMonth(k)
      .then((r) => {
        if (r && !pending.current.get(k)) setMonths((prev) => new Map(prev).set(k, r));
      })
      .catch(() => {});
  };

  useEffect(
    () =>
      onMonthsChanged((keys) => {
        for (const k of keys) {
          if (pending.current.get(k)) stale.current.add(k);
          else refresh(k);
        }
      }),
    [],
  );

  // `change` runs twice: on the screen's copy right away, and on the stored month inside the
  // write, so another window's edits to the same month survive. It must not have side effects.
  const save = (change: (r: MonthRecord) => MonthRecord) => {
    const k = key;
    const fallback = record;
    setMonths((prev) => new Map(prev).set(k, change(prev.get(k) ?? fallback)));
    pending.current.set(k, (pending.current.get(k) ?? 0) + 1);
    requestPersistence();
    const settle = () => {
      const left = pending.current.get(k)! - 1;
      if (left) pending.current.set(k, left);
      else pending.current.delete(k);
      return left;
    };
    updateMonth(k, fallback, change)
      .then((stored) => {
        // Keep the indicator up while saves keep coming; hide it once they stop.
        setSaved(true);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 1200);
        if (settle()) return;
        if (stale.current.delete(k)) refresh(k);
        else setMonths((prev) => new Map(prev).set(k, stored));
      })
      .catch(() => {
        if (!settle()) refresh(k);
        setError("Last change couldn't be saved.");
      });
  };

  const restore = async (records: MonthRecord[]) => {
    await putMonths(records);
    requestPersistence();
    setMonths((prev) => {
      const next = new Map(prev);
      for (const r of records) next.set(r.key, r);
      return next;
    });
  };

  const toggle = (habitId: string, day: number) => {
    setLastToggled({ key, habitId, day });
    save((r) => {
      const row = { ...(r.checks[habitId] ?? {}) };
      const cur = row[day];
      const next: Mark | undefined = cur === undefined ? 1 : cur === 1 ? 2 : undefined;
      if (next === undefined) delete row[day];
      else row[day] = next;
      return { ...r, checks: { ...r.checks, [habitId]: row } };
    });
  };

  // Clicking a date cycles the whole column like a single box: done -> missed -> empty.
  const toggleDay = (day: number) => {
    if (!record.habits.length || day > elapsed) return;
    setLastToggled({ key, habitId: null, day });
    save((r) => {
      const next = nextColumnMark(r, day);
      const checks = { ...r.checks };
      for (const h of r.habits) {
        const row = { ...(checks[h.id] ?? {}) };
        if (next === undefined) delete row[day];
        else row[day] = next;
        checks[h.id] = row;
      }
      return { ...r, checks };
    });
  };

  // Arrow keys move focus around the grid of day boxes.
  const onGridKey = (e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).dataset.cell;
    if (!cell) return;
    const [r, d] = cell.split("-").map(Number);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const nr = Math.min(Math.max(r + move[0], 0), record.habits.length - 1);
    const nd = Math.min(Math.max(d + move[1], 1), Math.max(elapsed, 1));
    const target = document.querySelector<HTMLButtonElement>(`[data-cell="${nr}-${nd}"]`);
    target?.focus();
    highlightDay(nd);
  };

  // Keyboard focus sets the column highlight too, so drop it once focus leaves the grid.
  const onGridBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) highlightDay(null);
  };

  const highlightDay = (d: number | null) => {
    const table = tableRef.current;
    if (!table) return;
    if (d === null) delete table.dataset.hoverDay;
    else if (table.dataset.hoverDay !== String(d)) table.dataset.hoverDay = String(d);
  };

  const onGridHover = (e: React.MouseEvent) => {
    const col = (e.target as HTMLElement).closest<HTMLElement>("[data-col]")?.dataset.col;
    if (col) highlightDay(Number(col));
  };

  const rename = (habitId: string, name: string) =>
    save((r) => ({ ...r, habits: r.habits.map((h) => (h.id === habitId ? { ...h, name } : h)) }));

  const addHabit = () => {
    if (record.habits.length >= MAX_HABITS) return;
    const id = newId();
    save((r) => (r.habits.length >= MAX_HABITS ? r : { ...r, habits: [...r.habits, { id, name: "" }] }));
  };

  const removeHabit = (habitId: string) => {
    if (record.habits.length <= MIN_HABITS) return;
    save((r) => {
      if (r.habits.length <= MIN_HABITS) return r;
      const checks = { ...r.checks };
      delete checks[habitId];
      return { ...r, habits: r.habits.filter((h) => h.id !== habitId), checks };
    });
  };

  // Moves by id, since another window may have added or removed rows in the meantime.
  const moveHabit = (from: number, to: number) => {
    if (to < 0 || to >= record.habits.length || from === to) return;
    const id = record.habits[from].id;
    save((r) => {
      const at = r.habits.findIndex((h) => h.id === id);
      if (at < 0) return r;
      const habits = [...r.habits];
      const [moved] = habits.splice(at, 1);
      habits.splice(Math.min(to, habits.length), 0, moved);
      return { ...r, habits };
    });
  };

  const startDrag = (e: React.PointerEvent<HTMLElement>, row: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const els = rowEls(tbodyRef.current);
    const scale = scaleOf(els[row]);
    const rects = els.map((el) => el.getBoundingClientRect());
    setDrag({
      id: record.habits[row].id, from: row, to: row, dy: 0, startY: e.clientY, scale,
      mids: rects.map((r) => (r.top + r.height / 2) / scale), h: rects[row].height / scale,
    });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const { from, mids } = drag;
    // Keep the row inside the table.
    const dy = Math.min(Math.max((e.clientY - drag.startY) / drag.scale, mids[0] - mids[from]), mids[mids.length - 1] - mids[from]);
    const center = mids[from] + dy;
    let to = from;
    while (to < mids.length - 1 && center > mids[to + 1]) to++;
    while (to > 0 && center < mids[to - 1]) to--;
    setDrag({ ...drag, dy, to });
  };

  const endDrag = () => {
    if (!drag) return;
    flipFrom.current = rowTops(tbodyRef.current);
    setDrag(null);
    moveHabit(drag.from, drag.to);
  };

  const onHandleKey = (e: React.KeyboardEvent, row: number) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    flipFrom.current = rowTops(tbodyRef.current);
    moveHabit(row, row + delta);
  };

  // While dragging, rows between the old and new slot step aside by one row height.
  const shiftFor = (row: number) => {
    if (!drag) return 0;
    if (row === drag.from) return drag.dy;
    if (drag.from < row && row <= drag.to) return -drag.h;
    if (drag.to <= row && row < drag.from) return drag.h;
    return 0;
  };

  useLayoutEffect(() => {
    actionsRef.current = {
      toggle, rename, remove: removeHabit, dragStart: startDrag, dragMove: moveDrag, dragEnd: endDrag, handleKey: onHandleKey,
    };
  });

  const possible = record.habits.length * elapsed;
  const totalDone = scores.reduce((a, b) => a + b, 0);

  const pct = possible ? Math.round((totalDone / possible) * 100) : null;

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setLastToggled(null);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div className="flex w-full flex-1 flex-col justify-center px-5 py-8 short:py-5 lg:px-8">
      <header className="mb-6 flex shrink-0 short:mb-4 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-md px-2 py-1 text-xl text-zinc-400 dark:text-zinc-500 transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.97] motion-reduce:active:scale-100">‹</button>
          <h1 className="min-w-44 text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {MONTH_NAMES[month]} {year}
          </h1>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-md px-2 py-1 text-xl text-zinc-400 dark:text-zinc-500 transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.97] motion-reduce:active:scale-100">›</button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
              className="ml-2 rounded-md px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
          <span
            aria-hidden={!saved}
            className={`flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" /> Saved
          </span>
          {pct !== null && <span>{pct}% done</span>}
          <ShareButton
            title={`${MONTH_NAMES[month]} ${year}`}
            habits={record.habits}
            checks={record.checks}
            year={year}
            month={month}
            days={days}
            elapsed={elapsed}
            todayDay={isCurrentMonth ? today.getDate() : 0}
          />
          <BackupButton months={months} onRestore={restore} />
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      <style>{COLUMN_HOVER_CSS}</style>
      <section className={`overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800${drag ? " cursor-grabbing select-none" : ""}`} onMouseOver={onGridHover} onMouseLeave={() => highlightDay(null)}>
        <table ref={tableRef} className="w-full table-fixed border-collapse text-zinc-900 dark:text-zinc-100">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-8 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950" />
              <th className="sticky left-8 z-20 border-b border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 w-28 lg:w-36 xl:w-44">
                Habit
              </th>
              {dayList.map(({ d, weekend, label }) => {
                const isToday = isCurrentMonth && d === today.getDate();
                const next = nextColumnMark(record, d);
                const action = next === 1 ? "mark all habits done" : next === 2 ? "mark all habits missed" : "clear all habits";
                return (
                  <th
                    key={d}
                    data-col={d}
                    className="border-b border-zinc-200 dark:border-zinc-800 px-0 py-2 text-center font-normal"
                  >
                    <button
                      type="button"
                      disabled={d > elapsed || !record.habits.length}
                      onClick={() => toggleDay(d)}
                      aria-label={`${label}: ${action}`}
                      title={`${action[0].toUpperCase()}${action.slice(1)} for this day`}
                      data-col-num={d}
                      data-today={isToday || undefined}
                      className={`mx-auto grid size-5 cursor-pointer disabled:cursor-default place-items-center rounded-full text-[11px] tabular-nums lg:size-6 lg:text-xs ${
                        isToday
                          ? "bg-zinc-900 dark:bg-zinc-100 font-semibold text-white dark:text-zinc-900"
                          : weekend
                              ? "text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {d}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={tbodyRef} onKeyDown={onGridKey} onBlur={onGridBlur}>
            {record.habits.map((habit, row) => (
              <HabitRow
                key={habit.id}
                row={row}
                habit={habit}
                marks={record.checks[habit.id] ?? NO_MARKS}
                elapsed={elapsed}
                dayList={dayList}
                todayDay={isCurrentMonth ? today.getDate() : 0}
                animateDay={lastToggled?.key === key && (lastToggled.habitId ?? habit.id) === habit.id ? lastToggled.day : 0}
                canRemove={record.habits.length > MIN_HABITS}
                shift={shiftFor(row)}
                dragging={drag?.id === habit.id}
                dragActive={drag !== null}
                actions={rowActions}
              />
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <p className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Box mark={1} /> Done</span>
          <span className="flex items-center gap-1.5"><Box mark={2} /> Missed</span>
          <span className="hidden items-center gap-3 text-zinc-400 dark:text-zinc-500 md:flex">
            <span className="flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1"><Kbd>Space</Kbd> mark</span>
            <span aria-hidden>·</span>
            <span>click a date to mark the whole day</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">drag <span className="font-medium">⋮⋮</span> to reorder</span>
          </span>
        </p>
        <button
          type="button"
          onClick={addHabit}
          disabled={record.habits.length >= MAX_HABITS}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-xs transition-[background-color,transform] duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900"
        >
          + Add habit <span className="text-zinc-400 dark:text-zinc-500">{record.habits.length}/{MAX_HABITS}</span>
        </button>
      </div>

      <Charts
        days={days}
        scores={scores}
        missed={missed}
        series={series}
        max={record.habits.length}
        elapsed={elapsed}
        yearly={yearly}
      />
    </div>
  );
}

const HabitRow = memo(function HabitRow({
  row, habit, marks, elapsed, dayList, todayDay, animateDay,
  canRemove, shift, dragging, dragActive, actions,
}: {
  row: number;
  habit: Habit;
  marks: Record<number, Mark>;
  elapsed: number;
  dayList: Day[];
  todayDay: number;
  animateDay: number;
  canRemove: boolean;
  shift: number;
  dragging: boolean;
  dragActive: boolean;
  actions: RowActions;
}) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const askRemove = () => {
    if (confirming) return actions.remove(habit.id);
    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), 3000);
  };

  const index = row + 1;
  const label = habit.name.trim() || `Habit ${index}`;

  return (
    <tr
      data-row-id={habit.id}
      style={shift ? { transform: `translateY(${shift}px)` } : undefined}
      className={`group/row ${
        dragging
          ? "relative z-20 bg-white dark:bg-zinc-900 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.18),0_0_0_1px_rgb(0_0_0/0.06)] dark:shadow-[0_8px_24px_-6px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.08)]"
          : dragActive
            ? "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            : ""
      }`}
    >
      <td className="sticky left-0 z-10 border-b border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-0 group-last/row:border-b-0">
        <button
          type="button"
          onPointerDown={(e) => actions.dragStart(e, row)}
          onPointerMove={actions.dragMove}
          onPointerUp={actions.dragEnd}
          onPointerCancel={actions.dragEnd}
          onKeyDown={(e) => actions.handleKey(e, row)}
          aria-label={`Reorder ${label}, position ${index}`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          title="Drag to reorder"
          className={`group/handle grid h-10 w-full short:h-8 touch-none place-items-center text-xs tabular-nums text-zinc-400 dark:text-zinc-500 outline-none hover:text-zinc-600 dark:hover:text-zinc-400 focus-visible:text-zinc-900 dark:focus-visible:text-zinc-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${
            dragging ? "cursor-grabbing text-zinc-600 dark:text-zinc-400" : "cursor-grab"
          }`}
        >
          <span className={dragging ? "hidden" : "group-hover/row:hidden group-focus-visible/handle:hidden"}>{index}</span>
          <svg viewBox="0 0 10 16" aria-hidden className={`h-3.5 w-2.5 ${dragging ? "block" : "hidden group-hover/row:block group-focus-visible/handle:block"}`}>
            {[3, 8, 13].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />))}
          </svg>
        </button>
      </td>
      <td className="sticky left-8 z-10 border-b border-r border-zinc-100 dark:border-zinc-900 border-r-zinc-200 dark:border-r-zinc-800 bg-white dark:bg-zinc-950 group-last/row:border-b-0 group/name">
        <div className="relative flex items-center">
          <input
            value={habit.name}
            onChange={(e) => actions.rename(habit.id, e.target.value)}
            placeholder={`Habit ${index}`}
            maxLength={40}
            aria-label={`Habit ${index} name`}
            className={`w-full min-w-0 rounded-md bg-transparent px-2 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors placeholder:font-normal placeholder:text-zinc-300 dark:placeholder:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:bg-zinc-50 dark:focus:bg-zinc-900 focus:outline-none ${
              // Reserve room for the remove button only while it's visible.
              !canRemove ? "" : confirming ? "pr-20" : "group-hover/name:pr-8 group-focus-within/name:pr-8"
            }`}
          />
          {canRemove && (
            <button
              type="button"
              onClick={askRemove}
              aria-label={`Remove ${label}`}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-xs transition-[opacity,color,background-color] duration-150 ${
                confirming
                  ? "bg-rose-600 text-white opacity-100"
                  : "pointer-events-none text-zinc-400 dark:text-zinc-500 opacity-0 hover:text-rose-600 dark:hover:text-rose-400 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/name:pointer-events-auto group-hover/name:opacity-100 group-focus-within/name:pointer-events-auto group-focus-within/name:opacity-100"
              }`}
            >
              {confirming ? "Remove?" : "✕"}
            </button>
          )}
        </div>
      </td>
      {dayList.map(({ d, label: dateLabel }) => {
        const mark = marks[d];
        const future = d > elapsed;
        const linkLeft = mark === 1 && marks[d - 1] === 1;
        const linkRight = mark === 1 && marks[d + 1] === 1;
        // Only connectors next to the box just toggled fade in, in step with its check.
        const linkFade = animateDay > 0 && Math.abs(d - animateDay) <= 1 ? "link-fade" : "";
        const state = mark === 1 ? "Done" : mark === 2 ? "Missed" : future ? "Upcoming" : "Not marked";
        return (
          <td
            key={d}
            data-col={d}
            className={`relative border-b border-zinc-100 dark:border-zinc-900 p-0 text-center group-last/row:border-b-0 ${
              d === todayDay ? "bg-zinc-50/60 dark:bg-zinc-900/60" : ""
            }`}
          >
            {linkLeft && <span aria-hidden className={`absolute left-0 right-1/2 top-1/2 h-1.5 -translate-y-1/2 bg-emerald-100 dark:bg-emerald-500/20 ${linkFade}`} />}
            {linkRight && <span aria-hidden className={`absolute left-1/2 right-0 top-1/2 h-1.5 -translate-y-1/2 bg-emerald-100 dark:bg-emerald-500/20 ${linkFade}`} />}
            <button
              type="button"
              disabled={future}
              data-cell={`${row}-${d}`}
              onClick={() => actions.toggle(habit.id, d)}
              title={`${label} · ${dateLabel} · ${state}`}
              aria-label={`${label}, ${dateLabel}: ${state}`}
              className="group/box relative grid h-10 w-full short:h-8 place-items-center outline-none disabled:cursor-default"
            >
              <Box mark={mark} today={d === todayDay} future={future} animate={d === animateDay} />
            </button>
          </td>
        );
      })}
    </tr>
  );
});

function Box({ mark, today, future, animate }: { mark?: Mark; today?: boolean; future?: boolean; animate?: boolean }) {
  const base =
    "relative grid size-[18px] place-items-center rounded-[5px] border lg:size-[22px] lg:rounded-[6px] transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active/box:scale-[0.95] motion-reduce:group-active/box:scale-100 group-focus-visible/box:ring-2 group-focus-visible/box:ring-zinc-900 dark:group-focus-visible/box:ring-zinc-100 group-focus-visible/box:ring-offset-2 dark:group-focus-visible/box:ring-offset-zinc-950";

  if (mark === 1) {
    return (
      <span className={`${base} border-emerald-600 bg-emerald-500 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(16_185_129/0.35)]`}>
        <svg key="done" viewBox="0 0 16 16" className="size-3 lg:size-3.5" aria-hidden>
          <path
            d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
            pathLength={1}
            className={animate ? "check-draw" : ""}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (mark === 2) {
    return (
      <span className={`${base} border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400`}>
        <svg key="missed" viewBox="0 0 16 16" className={`size-2.5 lg:size-3${animate ? " check-fade" : ""}`} aria-hidden>
          <path
            d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  if (future) {
    return <span className={`${base} border-dashed border-zinc-200 dark:border-zinc-800 bg-transparent`} />;
  }
  return (
    <span
      className={`${base} bg-white dark:bg-zinc-900 shadow-xs group-hover/box:border-zinc-400 dark:group-hover/box:border-zinc-500 group-hover/box:shadow-sm ${
        today ? "border-zinc-900/60 dark:border-zinc-100/60 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10" : "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {/* faint preview of the check on hover */}
      <svg key="empty" viewBox="0 0 16 16" className="size-3 text-zinc-300 dark:text-zinc-600 opacity-0 lg:size-3.5 transition-opacity duration-150 group-hover/box:opacity-100" aria-hidden>
        <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1 font-sans text-[10px] text-zinc-500 dark:text-zinc-400 shadow-[0_1px_0_rgb(0_0_0/0.06)]">
      {children}
    </kbd>
  );
}
