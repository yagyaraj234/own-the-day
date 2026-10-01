import type { MetadataRoute } from "next";
import { ICON_SIZES } from "@/lib/brand-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Own The Day",
    short_name: "Own The Day",
    description: "A monthly habit tracker with a daily score graph, saved in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      ...ICON_SIZES.map((s) => ({ src: `/app-icon/${s}`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const })),
      ...ICON_SIZES.map((s) => ({ src: `/app-icon/${s}`, sizes: `${s}x${s}`, type: "image/png", purpose: "maskable" as const })),
    ],
  };
}
