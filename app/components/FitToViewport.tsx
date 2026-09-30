"use client";

import { useLayoutEffect, useRef } from "react";

// Lays the page out fluidly between 768px (tablet portrait) and 1320px wide and at least the
// viewport's height, so desktops and tablets render 1:1. Only when the content can't fit (phones,
// very short windows) is it scaled down, so the page never scrolls and stays centered.
// Scale is applied as a transform, so layout width doesn't depend on it and there's no resize loop.
export default function FitToViewport({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const o = outer.current!;
    const i = inner.current!;
    const update = () => {
      const scale = Math.min(1, o.clientWidth / i.offsetWidth, o.clientHeight / i.offsetHeight);
      i.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    update();
    // Ease scale changes (switching chart, adding a habit) only after the first fit.
    const raf = requestAnimationFrame(() => { i.dataset.ready = ""; });
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={outer} className="relative h-dvh w-full overflow-hidden">
      <div
        ref={inner}
        style={{ transform: "translate(-50%, -50%)" }}
        className="absolute left-1/2 top-1/2 flex min-h-full w-[clamp(768px,100%,1320px)] origin-center flex-col motion-safe:data-ready:transition-transform motion-safe:data-ready:duration-200 motion-safe:data-ready:ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        {children}
      </div>
    </div>
  );
}
