import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadGoogleFonts } from "@/lib/og-fonts";
import { decodeShare } from "@/lib/share";
import ShareCard, { CARD_H, CARD_W } from "../ShareCard";

export async function GET(request: NextRequest) {
  const { searchParams, host } = request.nextUrl;
  const shared = decodeShare(searchParams.get("d") ?? undefined);
  if (!shared) return new Response("Invalid share link", { status: 400 });
  const k = searchParams.get("s") === "2" ? 2 : 1;

  return new ImageResponse(<ShareCard shared={shared} host={host} k={k} />, {
    width: CARD_W * k,
    height: CARD_H * k,
    fonts: await loadGoogleFonts("Geist", [400, 500, 600]),
    // The image is fully determined by the URL.
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
