import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Calculator, MessageCircleQuestion } from "lucide-react";
import type { advisor } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import type { AdvisorMessage } from "@/store/useTwin";
import { signedUsd, usd } from "@/twin/format";
import { actionsFor, runAdvisorAction } from "./actions";

/** The tool results' fields this file reads (results are plain JSON; every field is checked before use). */
type R = Partial<Record<"netInvestment" | "annualSavings" | "annualSavingsLow" | "annualSavingsHigh" | "paybackYears" | "netBenefit10Years" | "before" | "after" | "change" | "test" | "kind" | "annualCost" | "annualCostPct" | "carbonTonnes" | "bestPackage" | "budget" | "role" | "name" | "combinationsTested" | "emptyReason" | "upgrades" | "id" | "totals" | "hotels" | "rooms" | "savingsPotential" | "hotel" | "package" | "error", unknown>>;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v: unknown) => (typeof v === "string" ? v : "");
const yrs = (v: unknown) => (typeof v === "number" ? `${v} yr` : "not reached");
const t = (v: unknown) => `${n(v).toLocaleString("en-US")} t CO₂e`;

const TITLES: Record<advisor.ToolName, string> = {
  run_scenario: "What-if",
  find_best_plan: "Best plan for the budget",
  evaluate_upgrades: "These upgrades together",
  compare_upgrades: "Upgrades compared",
  run_stress_test: "Stress test",
  portfolio_overview: "The hotel chain",
  portfolio_optimize: "Budget split across the chain",
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="num text-right font-medium">{v}</dd>
    </div>
  );
}

function Money({ f }: { f: R }) {
  return (
    <>
      <Row k="Net investment" v={usd(n(f.netInvestment))} />
      <Row k="Yearly savings" v={`${usd(n(f.annualSavings))} (${usd(n(f.annualSavingsLow))}–${usd(n(f.annualSavingsHigh))})`} />
      <Row k="Payback" v={yrs(f.paybackYears)} />
      <Row k="10-year net benefit" v={usd(n(f.netBenefit10Years))} />
    </>
  );
}

/** One engine result as a small card. Every figure is the tool's result, formatted; nothing is computed here. */
export function ToolResultCard({ run }: { run: advisor.ToolRun }) {
  const r = run.result as R;
  if ("error" in r) return null;
  let body: React.ReactNode = null;
  if (run.name === "run_scenario" || run.name === "run_stress_test") {
    const before = (r.before ?? {}) as R;
    const after = (r.after ?? {}) as R;
    const change = (r.change ?? {}) as R;
    body = (
      <>
        {run.name === "run_stress_test" && <Row k={s(r.test)} v={s(r.kind).split(" (")[0] ?? ""} />}
        <Row k="Yearly energy cost" v={`${usd(n(before.annualCost))} → ${usd(n(after.annualCost))}`} />
        <Row k="Change" v={`${signedUsd(n(change.annualCost))} (${n(change.annualCostPct) > 0 ? "+" : ""}${n(change.annualCostPct)}%)`} />
        <Row k="Carbon" v={`${t(before.carbonTonnes)} → ${t(after.carbonTonnes)}`} />
      </>
    );
  } else if (run.name === "find_best_plan") {
    const best = r.bestPackage as R | null;
    body = best ? (
      <>
        <Row k={`${s(best.role)} · ${usd(n(r.budget))} budget`} v={s(best.name)} />
        <Money f={best} />
        <Row k="Combinations tested" v={n(r.combinationsTested).toLocaleString("en-US")} />
      </>
    ) : (
      <p className="text-muted-foreground">{s(r.emptyReason) || "No package fits this budget."}</p>
    );
  } else if (run.name === "evaluate_upgrades") {
    body = (
      <>
        <Row k="Upgrades" v={(r.upgrades as string[]).join(", ")} />
        <Money f={r} />
      </>
    );
  } else if (run.name === "compare_upgrades") {
    const rows = (r.upgrades as R[]).slice(0, 6);
    body = rows.map((u) => <Row key={s(u.id)} k={s(u.name)} v={`${usd(n(u.annualSavings))}/yr · ${yrs(u.paybackYears)}`} />);
  } else if (run.name === "portfolio_overview") {
    const tot = (r.totals ?? {}) as R;
    body = (
      <>
        <Row k="Hotels · rooms" v={`${n(tot.hotels)} · ${n(tot.rooms).toLocaleString("en-US")}`} />
        <Row k="Yearly energy cost" v={usd(n(tot.annualCost))} />
        {(r.hotels as R[]).slice(0, 3).map((h, i) => (
          <Row key={s(h.name)} k={`Priority ${i + 1}: ${s(h.name)}`} v={`${usd(n(h.savingsPotential))}/yr potential`} />
        ))}
      </>
    );
  } else if (run.name === "portfolio_optimize") {
    const tot = (r.totals ?? {}) as R;
    body = (
      <>
        <Row k="Budget" v={usd(n(r.budget))} />
        <Row k="Net investment" v={usd(n(tot.netInvestment))} />
        <Row k="Yearly savings" v={usd(n(tot.annualSavings))} />
        <Row k="Payback" v={yrs(tot.paybackYears)} />
        {(r.hotels as R[]).slice(0, 5).map((h) => (
          <Row key={s(h.hotel)} k={s(h.hotel)} v={n(h.netInvestment) > 0 ? `${usd(n(h.netInvestment))} · ${s(h.package)}` : "nothing"} />
        ))}
      </>
    );
  }
  return (
    <figure className="rounded-lg border border-border bg-background/60 p-2.5 text-xs" data-testid="advisor-tool-card" data-tool={run.name}>
      <figcaption className="mb-1.5 flex items-center gap-1.5 font-medium">
        <Calculator className="size-3.5 text-primary" aria-hidden /> {TITLES[run.name]}
      </figcaption>
      <dl className="space-y-0.5">{body}</dl>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Computed by the Energy Twin engine · modeled estimate</p>
    </figure>
  );
}

function useGoHome(): (() => void) | undefined {
  // Outside a router (tests, previews) there is no portfolio page to go to.
  const router = useRouter({ warn: false });
  return router ? () => void router.navigate({ to: "/" }) : undefined;
}

/**
 * Under an advisor answer: the engine results it used (cards), action buttons derived from those runs, and follow-up questions.
 * Placed by AdvisorPanel and the portfolio chat.
 */
export function AdvisorMessageExtras({ message }: { message: AdvisorMessage }) {
  const ask = useTwin((st) => st.askAdvisor);
  const busy = useTwin((st) => st.advisorBusy);
  const reduce = useTwin((st) => st.reduceEffects);
  const goHome = useGoHome();
  const [status, setStatus] = useState("");
  if (message.role !== "advisor") return null;
  const runs = message.runs ?? [];
  const actions = actionsFor(message);
  const followUps = message.followUps ?? [];
  if (!runs.length && !followUps.length) return null;
  return (
    <div className="mt-1 w-full max-w-full space-y-2" data-testid="advisor-extras">
      {runs.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {runs.map((r) => <ToolResultCard key={r.id} run={r} />)}
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Actions from these results">
          {actions.map((a) => (
            <button
              key={`${a.kind}-${a.runId}`}
              type="button"
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStatus(runAdvisorAction(a, message, { goHome, reduce }))}
              data-testid="advisor-action"
              data-action={a.kind}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{status}</p>
      {status && <p className="text-[11px] text-muted-foreground" data-testid="advisor-action-status">{status}</p>}
      {followUps.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Follow-up questions">
          {followUps.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-left text-xs hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void ask(q, { scope: message.scope ?? "hotel" })}
              data-testid="advisor-followup"
            >
              <MessageCircleQuestion className="size-3 shrink-0" aria-hidden /> {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
