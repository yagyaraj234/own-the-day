// 1 = done, 2 = missed (the red X on paper). No entry = not marked yet.
export type Mark = 1 | 2;

export interface Habit {
  id: string;
  name: string;
}

export interface MonthRecord {
  key: string; // "YYYY-MM"
  habits: Habit[];
  checks: Record<string, Record<number, Mark>>; // habitId -> day -> mark
}

const DB_NAME = "owntheday";
const DB_VERSION = 1;
const STORE = "months";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function getAllMonths(): Promise<MonthRecord[]> {
  return run("readonly", (s) => s.getAll() as IDBRequest<MonthRecord[]>);
}

export function getMonth(key: string): Promise<MonthRecord | undefined> {
  return run("readonly", (s) => s.get(key) as IDBRequest<MonthRecord | undefined>);
}

// Other windows of the app hear which months changed, so they can re-read them.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DB_NAME) : null;

export function onMonthsChanged(fn: (keys: string[]) => void): () => void {
  if (!channel) return () => {};
  const listener = (e: MessageEvent<{ keys: string[] }>) => fn(e.data.keys);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}

// Reads, changes and writes a month in one transaction, so the change applies to what's stored
// now rather than to a copy another window may have since overwritten. `fallback` stands in for
// a month that hasn't been saved yet.
export async function updateMonth(
  key: string,
  fallback: MonthRecord,
  change: (record: MonthRecord) => MonthRecord,
): Promise<MonthRecord> {
  const db = await openDB();
  const next = await new Promise<MonthRecord>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let result: MonthRecord;
    const req = store.get(key);
    req.onsuccess = () => {
      result = change((req.result as MonthRecord | undefined) ?? fallback);
      store.put(result);
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  channel?.postMessage({ keys: [key] });
  return next;
}

// One transaction, so a restore lands completely or not at all.
export async function putMonths(records: MonthRecord[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const r of records) store.put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  channel?.postMessage({ keys: records.map((r) => r.key) });
}

// Without this the browser may evict the database when the disk runs low. Chrome grants or
// refuses silently; Firefox asks the user, so it's only asked once data exists and not again
// once granted.
let persistRequested = false;
export function requestPersistence() {
  if (persistRequested || !navigator.storage?.persist) return;
  persistRequested = true;
  navigator.storage
    .persisted()
    .then((granted) => granted || navigator.storage.persist())
    .catch(() => {});
}
