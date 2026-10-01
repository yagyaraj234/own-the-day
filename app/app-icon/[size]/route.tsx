import type { NextRequest } from "next/server";
import { ICON_SIZES, markIcon } from "@/lib/brand-icon";

export const dynamicParams = false;
export function generateStaticParams() {
  return ICON_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/app-icon/[size]">) {
  const { size } = await ctx.params;
  return markIcon(Number(size));
}
