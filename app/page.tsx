import FitToViewport from "./components/FitToViewport";
import HabitTracker from "./components/HabitTracker";

export default function Home() {
  return (
    <main className="flex-1">
      <FitToViewport>
        <HabitTracker />
      </FitToViewport>
    </main>
  );
}
