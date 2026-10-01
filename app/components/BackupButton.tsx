"use client";

import { useEffect, useRef, useState } from "react";
import { backupJSON, lastBackupAt, markBackedUp, parseBackup } from "@/lib/backup";
import type { MonthRecord } from "@/lib/db";

const DATE = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function BackupButton({
  months,
  onRestore,
}: {
  months: Map<string, MonthRecord>;
  onRestore: (records: MonthRecord[]) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<Date | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const flash = (msg: string) => {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 4000);
  };

  const open = () => {
    setLast(lastBackupAt());
    setStatus(null);
    dialogRef.current?.showModal();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([backupJSON(months.values())], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `owntheday-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url));
    markBackedUp();
    setLast(new Date());
    flash("Backup downloaded");
  };

  const restore = async (file: File) => {
    const records = parseBackup(await file.text());
    if (!records) return flash("That file isn't an Own The Day backup.");
    if (!records.length) return flash("That backup is empty.");

    const replaced = records.filter((r) => {
      const cur = months.get(r.key);
      return cur && Object.values(cur.checks).some((row) => Object.keys(row).length);
    }).length;
    if (
      replaced &&
      !confirm(
        `${replaced} ${replaced === 1 ? "month already has" : "months already have"} marks here. ` +
          "Replace them with the backup? Months not in the backup stay as they are.",
      )
    ) return;

    try {
      await onRestore(records);
      flash(`Restored ${records.length} ${records.length === 1 ? "month" : "months"}`);
    } catch {
      flash("Couldn't restore the backup.");
    }
  };

  const btn =
    "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-xs transition-[background-color,transform] duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <button type="button" onClick={open} className={btn}>
        Backup
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop:bg-zinc-900/30 dark:backdrop:bg-black/60"
      >
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Back up your habits</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded-md px-2 py-0.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Everything is saved only in this browser. Clearing browsing data or using a private window
            removes it, so download a backup now and then. You can restore it here or in another browser.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={download}
              disabled={!months.size}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 transition-[background-color,transform] duration-150 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download backup
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
              Restore from file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) restore(file);
              }}
            />
          </div>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {status ?? (last ? `Last backup: ${DATE.format(last)}` : "No backup downloaded yet.")}
          </p>
        </div>
      </dialog>
    </>
  );
}
