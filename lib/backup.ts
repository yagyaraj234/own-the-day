import type { Habit, Mark, MonthRecord } from "./db";

const FORMAT = "owntheday-backup";
const VERSION = 1;
const LAST_BACKUP_KEY = "owntheday-last-backup";

type BackupFile = { format: typeof FORMAT; version: number; exportedAt: string; months: MonthRecord[] };

export function backupJSON(months: Iterable<MonthRecord>): string {
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    months: [...months].sort((a, b) => a.key.localeCompare(b.key)),
  };
  return JSON.stringify(file, null, 2);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Rebuilds each month from only the fields the app knows, so a hand-edited or foreign file
// can't put unexpected shapes into the database. Returns null if the file isn't a backup.
export function parseBackup(text: string): MonthRecord[] | null {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(file) || file.format !== FORMAT || typeof file.version !== "number" || file.version > VERSION) return null;
  if (!Array.isArray(file.months)) return null;

  const months: MonthRecord[] = [];
  for (const m of file.months) {
    if (!isObject(m) || typeof m.key !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.key)) return null;
    if (!Array.isArray(m.habits) || !isObject(m.checks)) return null;

    const habits: Habit[] = [];
    for (const h of m.habits) {
      if (!isObject(h) || typeof h.id !== "string" || !h.id || typeof h.name !== "string") return null;
      habits.push({ id: h.id, name: h.name.slice(0, 40) });
    }

    const checks: MonthRecord["checks"] = {};
    for (const { id } of habits) {
      const row: unknown = m.checks[id];
      if (!isObject(row)) continue;
      const marks: Record<number, Mark> = {};
      for (const [day, mark] of Object.entries(row)) {
        const d = Number(day);
        if (Number.isInteger(d) && d >= 1 && d <= 31 && (mark === 1 || mark === 2)) marks[d] = mark;
      }
      checks[id] = marks;
    }

    months.push({ key: m.key, habits, checks });
  }
  return months;
}

export function lastBackupAt(): Date | null {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {}
}
