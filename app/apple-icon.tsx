import { ImageResponse } from "next/og";
import { MARK } from "@/lib/brand";

// Home-screen icon: the mark in light cells on an ink tile. iOS rounds the corners itself.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const CELL = 32;
const GAP = 12;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <div style={{ display: "flex", flexWrap: "wrap", width: CELL * 3 + GAP * 2, gap: GAP }}>
          {MARK.map((on, i) => (
            <div key={i} style={{ width: CELL, height: CELL, borderRadius: 6, background: on ? "#fafafa" : "#3f3f46" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
