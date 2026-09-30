"use client";

import { useEffect, useRef, useState } from "react";
import { encodeShare, shareImageUrl, type SharedMonth } from "@/lib/share";

export default function ShareButton(props: SharedMonth & { title: string; pct: number | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(statusTimer.current), []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const text = props.pct === null
    ? `Starting my ${props.title} habit tracker on Own The Day.`
    : `${props.pct}% of my habits done in ${props.title}. Tracking every day with Own The Day.`;
  const fileName = `owntheday-${props.year}-${String(props.month + 1).padStart(2, "0")}.png`;

  const flash = (msg: string) => {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2000);
  };

  const open = async () => {
    // The link carries a read-only copy of this month, so it opens the same grid for anyone.
    // Its page advertises the same card as the preview image social sites show under the post.
    const data = encodeShare(props);
    setLink(`${window.location.origin}/share?d=${data}`);
    setImage(null);
    setStatus(null);
    dialogRef.current?.showModal();
    try {
      const res = await fetch(shareImageUrl(data, 2));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setStatus("Couldn't make the image. The link still works.");
    }
  };

  const file = image ? new File([image.blob], fileName, { type: "image/png" }) : null;
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
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-xs transition-[background-color,transform] duration-150 hover:bg-zinc-50 active:scale-[0.97] motion-reduce:active:scale-100";

  return (
    <>
      <button type="button" onClick={open} className={btn}>
        Share
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-900/30"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Share your month</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              ✕
            </button>
          </div>

          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing to optimize
            <img src={image.url} alt={`Habit grid for ${props.title}`} className="aspect-[1200/630] w-full rounded-lg border border-zinc-200" />
          ) : (
            <div className="grid aspect-[1200/630] w-full place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
              Making your image…
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canShareFile && (
              <button
                type="button"
                onClick={nativeShare}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-zinc-800 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                Share image…
              </button>
            )}
            <button type="button" onClick={download} className={btn}>Download</button>
            <button type="button" onClick={() => copyImage()} className={btn}>Copy image</button>
            <button type="button" onClick={copyLink} className={btn}>Copy link</button>
          </div>

          <div className="mt-4 border-t border-zinc-100 pt-4">
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
            <p className="mt-2 text-xs text-zinc-500" aria-live="polite">
              {status ?? "Your link shows this card as its preview once the app is on a public address."}
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
