import { STRESS_TESTS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { signedUsd } from "../format";

/** One-click events. Each lays a what-if over the hotel; click again to clear it. */
export function StressTests() {
  const active = useTwin((s) => s.activeStressTest);
  const apply = useTwin((s) => s.applyStressTest);
  const result = useTwin((s) => s.scenarioResult);
  const current = STRESS_TESTS.find((t) => t.id === active);
  return (
    <section aria-label="Stress tests" className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Stress tests</div>
      <div className="flex flex-wrap gap-2">
        {STRESS_TESTS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={active === t.id}
            onClick={() => apply(active === t.id ? null : t.id)}
            className={`rounded-full border px-3 py-1 text-sm ${active === t.id ? "border-primary bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:border-input"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="stress-description">
          {current.description}
          {result && <span className="ml-1 font-medium text-foreground">Estimated change: {signedUsd(result.delta.cost)} per year.</span>}
        </p>
      )}
    </section>
  );
}
