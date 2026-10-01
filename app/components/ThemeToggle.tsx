"use client";

import { useLayoutEffect } from "react";
import { THEME_KEY } from "@/lib/theme";

const saved = () => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};

export default function ThemeToggle() {
  // Strict Mode's dev remount resets <html> attributes to what React renders; put the choice back.
  useLayoutEffect(() => {
    const t = saved();
    if (t) document.documentElement.dataset.theme = t;
  }, []);

  const toggle = () => {
    const current = saved() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    // Color transitions on boxes and buttons would otherwise fade a beat behind the instant page
    // background swap. Kill them for the switch, flush styles, then let them back in.
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
    document.documentElement.dataset.theme = next;
    void getComputedStyle(document.body).backgroundColor;
    requestAnimationFrame(() => freeze.remove());
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  // Which icon shows is left to CSS, so the server render matches whatever theme is active.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="grid size-8 place-items-center rounded-md text-zinc-400 transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97] motion-reduce:active:scale-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <svg viewBox="0 0 16 16" className="size-4 dark:hidden" aria-hidden>
        <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 16 16" className="hidden size-4 dark:block" aria-hidden>
        <circle cx="8" cy="8" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
