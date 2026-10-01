import FitToViewport from "./components/FitToViewport";
import HabitTracker from "./components/HabitTracker";

export default function Home() {
  return (
    <main className="flex-1">
      <FitToViewport>
        <HabitTracker />
        <footer className="shrink-0 pb-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Built by{" "}
          <a
            href="https://x.com/heyraj__"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 dark:text-zinc-400 underline-offset-2 transition-colors duration-150 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
          >
            Raj
          </a>
        </footer>
      </FitToViewport>
    </main>
  );
}
