import type { Mark } from "./db";

// A shared month travels inside the link itself, since the tracker only lives in the sharer's
// browser. Marks are one digit per day ("0" unmarked, "1" done, "2" missed).
interface Snapshot {
  v: 1;
  k: string; // "YYYY-MM"
  e: number; // days that could be marked when shared
  t: number; // today's day of the month, 0 if the month isn't the current one
  h: [name: string, marks: string][];
}

export interface SharedMonth {
  year: number;
  month: number;
  days: number;
  elapsed: number;
  todayDay: number;
  habits: { id: string; name: string }[];
  checks: Record<string, Record<number, Mark>>;
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

// The card image is cached for a year per URL, so bump this whenever its design changes or
// browsers and social sites keep showing the old one.
const CARD_VERSION = 4;

export const shareImageUrl = (data: string, scale: 1 | 2 = 1) =>
  `/share/image?d=${data}&v=${CARD_VERSION}${scale === 2 ? "&s=2" : ""}`;

export function encodeShare(m: SharedMonth): string {
  const snap: Snapshot = {
    v: 1,
    k: `${m.year}-${String(m.month + 1).padStart(2, "0")}`,
    e: m.elapsed,
    t: m.todayDay,
    h: m.habits.map((h) => [
      h.name,
      Array.from({ length: m.days }, (_, i) => m.checks[h.id]?.[i + 1] ?? 0).join("").replace(/0+$/, ""),
    ]),
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(snap)));
}

// Returns null for anything that isn't a well-formed snapshot, so a mangled link shows a
// friendly message instead of a crash.
export function decodeShare(data: string | undefined): SharedMonth | null {
  if (!data || data.length > 8000) return null;
  try {
    const snap = JSON.parse(new TextDecoder().decode(fromBase64Url(data))) as Snapshot;
    const match = /^(\d{4})-(\d{2})$/.exec(snap.k);
    if (snap.v !== 1 || !match || !Array.isArray(snap.h) || snap.h.length > 12) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month < 0 || month > 11) return null;
    const days = new Date(year, month + 1, 0).getDate();
    const clamp = (n: unknown) => Math.min(Math.max(Math.floor(Number(n)) || 0, 0), days);

    const habits: SharedMonth["habits"] = [];
    const checks: SharedMonth["checks"] = {};
    snap.h.forEach(([name, marks], i) => {
      const id = `shared-${i}`;
      habits.push({ id, name: String(name).slice(0, 40) });
      checks[id] = {};
      String(marks).slice(0, days).split("").forEach((c, d) => {
        if (c === "1" || c === "2") checks[id][d + 1] = Number(c) as Mark;
      });
    });
    return { year, month, days, elapsed: clamp(snap.e), todayDay: clamp(snap.t), habits, checks };
  } catch {
    return null;
  }
}

export function monthStats(m: SharedMonth) {
  const done = m.habits.reduce(
    (n, h) => n + Object.values(m.checks[h.id] ?? {}).filter((v) => v === 1).length,
    0,
  );
  const possible = m.habits.length * m.elapsed;
  return { done, possible, pct: possible ? Math.round((done / possible) * 100) : null };
}

// Habits done per day, index 0 = day 1.
export const dailyScores = (m: SharedMonth) =>
  Array.from({ length: m.days }, (_, i) => m.habits.filter((h) => m.checks[h.id]?.[i + 1] === 1).length);

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
