"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { encodeShare, monthStats, shareImageUrl, type SharedMonth } from "@/lib/share";

export default memo(function ShareButton({ title, ...month }: SharedMonth & { title: string }) {
  // Rows left unnamed are placeholders, so they stay out of the image, the link and the score.
  const shared: SharedMonth = { ...month, habits: month.habits.filter((h) => h.name.trim()) };
  const { pct } = monthStats(shared);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const request = useRef(0);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(statusTimer.current), []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const text = pct === null
    ? `Starting my ${title} habit tracker on Own The Day.`
    : `${pct}% of my habits done in ${title}. Tracking every day with Own The Day.`;
  const fileName = `owntheday-${month.year}-${String(month.month + 1).padStart(2, "0")}.png`;

  const flash = (msg: string) => {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2000);
  };

  const open = async () => {
    // The link carries a read-only copy of this month, so it opens the same grid for anyone.
    // Its page advertises the same card as the preview image social sites show under the post.
    const data = encodeShare(shared);
    setLink(`${window.location.origin}/share?d=${data}`);
    setImage(null);
    setStatus(null);
    dialogRef.current?.showModal();
    // A slower image from an earlier opening mustn't replace this one.
    const id = ++request.current;
    try {
      const res = await fetch(shareImageUrl(data, 2));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (id === request.current) setImage({ blob, url: URL.createObjectURL(blob) });
    } catch {
      if (id === request.current) setStatus("Couldn't make the image. The link still works.");
    }
  };

  const file = useMemo(
    () => (image ? new File([image.blob], fileName, { type: "image/png" }) : null),
    [image, fileName],
  );
  const canShareFile =
    typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] });

  const nativeShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: "Own The Day", text: `${text} ${link}` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") flash("Couldn't open the share sheet");
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = fileName;
    a.click();
  };

  const copyImage = async (msg = "Image copied") => {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
      flash(msg);
    } catch {
      flash("Copying images isn't supported here");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash("Link copied");
    } catch {
      flash("Couldn't copy the link");
    }
  };

  const t = encodeURIComponent(text);
  const u = encodeURIComponent(link);
  const socials = [
    { name: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}` },
  ];

  const btn =
    "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-xs transition-[background-color,transform] duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.97] motion-reduce:active:scale-100";

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={!shared.habits.length}
        title={shared.habits.length ? undefined : "Name a habit to share your month"}
        className={`${btn} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900`}
      >
        Share
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop:bg-zinc-900/30 dark:backdrop:bg-black/60"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Share your month</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded-md px-2 py-0.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ✕
            </button>
          </div>

          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing to optimize
            <img src={image.url} alt={`Habit grid for ${title}`} className="aspect-[1200/630] w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
          ) : (
            <div className="grid aspect-[1200/630] w-full place-items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-400 dark:text-zinc-500">
              Making your image…
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canShareFile && (
              <button
                type="button"
                onClick={nativeShare}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 transition-[background-color,transform] duration-150 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                Share image…
              </button>
            )}
            <button type="button" onClick={download} className={btn}>Download</button>
            <button type="button" onClick={() => copyImage()} className={btn}>Copy image</button>
            <button type="button" onClick={copyLink} className={btn}>Copy link</button>
          </div>

          <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Also put the image on the clipboard, so it can be pasted into the post directly.
                  onClick={() => copyImage("Image copied. Paste it into your post if you want it attached.")}
                  className={btn}
                >
                  {s.name}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {status ?? "Your link shows this card as its preview once the app is on a public address."}
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
});
