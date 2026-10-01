import { ImageResponse } from "next/og";
import { MARK } from "./brand";

export const ICON_SIZES = [192, 512] as const;

// App icon: the mark in light cells on a full-bleed ink tile. Platforms round or mask the corners
// themselves; the mark stays inside the central 80% that Android's maskable icons keep.
export function markIcon(px: number, init?: ResponseInit) {
  const cell = (px * 32) / 180;
  const gap = (px * 12) / 180;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <div style={{ display: "flex", flexWrap: "wrap", width: cell * 3 + gap * 2, gap }}>
          {MARK.map((on, i) => (
            <div key={i} style={{ width: cell, height: cell, borderRadius: cell * 0.1875, background: on ? "#fafafa" : "#3f3f46" }} />
          ))}
        </div>
      </div>
    ),
    { width: px, height: px, ...init },
  );
}
