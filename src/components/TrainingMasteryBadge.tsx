import { trainingMasteryLevel, type TrainingMasteryLevel } from "@/lib/AppState";

const masteryPresentation: Record<TrainingMasteryLevel, { label: string; class: string }> = {
  new: { label: "New", class: "bg-muted text-muted-foreground" },
  learning: {
    label: "Learning",
    class: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  familiar: {
    label: "Familiar",
    class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  practiced: {
    label: "Practiced",
    class: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  reliable: {
    label: "Reliable",
    class: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  },
  strong: {
    label: "Strong",
    class: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  },
  mastered: {
    label: "Mastered",
    class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
};

export function TrainingMasteryBadge(props: { intervalIndex: number | undefined }) {
  const level = () => trainingMasteryLevel(props.intervalIndex);
  const presentation = () => masteryPresentation[level()];

  return (
    <span
      class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${presentation().class}`}
      data-mastery-level={level()}
    >
      {presentation().label}
    </span>
  );
}
