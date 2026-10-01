export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" };

// Satori can't read the woff2 that next/font serves, so pull fonts as TTF once per server
// process. Without network the image falls back to next/og's built-in font.
const cache = new Map<string, Promise<OgFont[]>>();

export function loadGoogleFonts(family: string, weights: readonly OgFont["weight"][]): Promise<OgFont[]> {
  const key = `${family}:${weights.join(",")}`;
  let fonts = cache.get(key);
  if (!fonts) {
    fonts = Promise.all(
      weights.map(async (weight) => {
        const css = await fetch(
          `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`,
        ).then((r) => r.text());
        const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
        if (!url) throw new Error("No TTF in Google Fonts response");
        const data = await fetch(url).then((r) => r.arrayBuffer());
        return { name: family, data, weight, style: "normal" } as const;
      }),
    ).catch(() => {
      cache.delete(key);
      return [];
    });
    cache.set(key, fonts);
  }
  return fonts;
}
