import { PiggyBank, Timer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTwin, type Goal } from "@/store/useTwin";

const goals: { id: Goal; label: string; icon: typeof PiggyBank }[] = [
  { id: "savings", label: "Biggest yearly savings", icon: PiggyBank },
  { id: "payback", label: "Fastest payback", icon: Timer },
  { id: "value", label: "Best 15-year value", icon: TrendingUp },
];

export function GoalCards() {
  const { goal, setGoal } = useTwin();
  return (
    <div role="radiogroup" aria-label="What matters most" className="grid gap-2">
      {goals.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={goal === id} onClick={() => setGoal(id)}
          className={cn("lift flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium",
            goal === id ? "border-primary bg-primary/5 shadow-glow" : "border-glass-border bg-glass hover:border-input")}>
          <Icon className={cn("h-4 w-4", goal === id ? "text-primary" : "text-muted-foreground")} />{label}
        </button>
      ))}
    </div>
  );
}
