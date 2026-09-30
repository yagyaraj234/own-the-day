import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { decodeShare } from "@/lib/share";
import ShareCard, { CARD_H, CARD_W } from "../ShareCard";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" };

// Satori can't read the woff2 that next/font serves, so pull Geist as TTF once per server
// process. Without network the card falls back to next/og's built-in font.
let fontsPromise: Promise<Font[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    ([400, 500, 600] as const).map(async (weight) => {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`).then((r) => r.text());
      const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
      if (!url) throw new Error("No TTF in Google Fonts response");
      const data = await fetch(url).then((r) => r.arrayBuffer());
      return { name: "Geist", data, weight, style: "normal" } as const;
    }),
  ).catch(() => {
    fontsPromise = null;
    return [];
  });
  return fontsPromise;
}

export async function GET(request: NextRequest) {
  const { searchParams, host } = request.nextUrl;
  const shared = decodeShare(searchParams.get("d") ?? undefined);
  if (!shared) return new Response("Invalid share link", { status: 400 });
  const k = searchParams.get("s") === "2" ? 2 : 1;

  return new ImageResponse(<ShareCard shared={shared} host={host} k={k} />, {
    width: CARD_W * k,
    height: CARD_H * k,
    fonts: await loadFonts(),
    // The image is fully determined by the URL.
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
