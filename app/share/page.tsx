import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { decodeShare, monthStats, MONTH_NAMES, shareImageUrl } from "@/lib/share";
import { CARD_H, CARD_W } from "./ShareCard";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

async function load(searchParams: Props["searchParams"]) {
  const { d } = await searchParams;
  const data = typeof d === "string" ? d : undefined;
  return { data, shared: decodeShare(data) };
}

// Social sites fetch the preview image server-side, so it needs an absolute URL.
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { data, shared } = await load(searchParams);
  if (!shared || !data) return { title: "Own The Day" };
  const { pct } = monthStats(shared);
  const title = `${MONTH_NAMES[shared.month]} ${shared.year}${pct === null ? "" : ` · ${pct}% done`}`;
  const description = "A month of habits, tracked one box a day.";
  const image = { url: `${await origin()}${shareImageUrl(data)}`, width: CARD_W, height: CARD_H, alt: `Habit grid for ${title}` };
  return {
    title: `${title} · Own The Day`,
    description,
    openGraph: { title, description, images: [image], type: "website", siteName: "Own The Day" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharePage({ searchParams }: Props) {
  const { data, shared } = await load(searchParams);

  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-8 sm:py-12">
      {shared && data ? (
        // eslint-disable-next-line @next/next/no-img-element -- already a generated PNG
        <img
          src={shareImageUrl(data, 2)}
          width={CARD_W}
          height={CARD_H}
          alt={`Habit grid for ${MONTH_NAMES[shared.month]} ${shared.year}`}
          className="mx-auto h-auto w-full max-w-[1200px] rounded-xl border border-zinc-200"
        />
      ) : (
        <p className="py-24 text-center text-sm text-zinc-500">This share link is broken or incomplete.</p>
      )}
      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-zinc-800 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Start your own tracker
        </Link>
      </div>
    </main>
  );
}
