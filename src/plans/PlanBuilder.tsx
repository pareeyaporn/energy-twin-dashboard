import { useMemo, useState } from "react";
import { Copy, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { CATALOG_CATEGORIES } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectActiveCustomPlan, selectCatalog, selectCustomPlanEvaluation, selectVisibleCustomPlans } from "@/store/hotelDerived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogCard } from "./CatalogCard";
import { PlanSummary } from "./PlanSummary";

/** Choose, create, duplicate, rename and delete custom plans. */
function PlanPicker() {
  const plans = useTwin(selectVisibleCustomPlans);
  const active = useTwin(selectActiveCustomPlan);
  const setActive = useTwin((s) => s.setActiveCustomPlan);
  const create = useTwin((s) => s.createCustomPlan);
  const duplicate = useTwin((s) => s.duplicateCustomPlan);
  const rename = useTwin((s) => s.renameCustomPlan);
  const remove = useTwin((s) => s.deleteCustomPlan);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing && active ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rename(active.id, name);
            setEditing(false);
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              rename(active.id, name);
              setEditing(false);
            }}
            aria-label="Plan name"
            className="h-8 min-w-0 flex-1 rounded-md border border-glass-border bg-background px-2 text-sm"
          />
        </form>
      ) : (
        <select
          value={active?.id ?? ""}
          onChange={(e) => setActive(e.target.value || null)}
          aria-label="Custom plan"
          className="h-8 min-w-0 flex-1 rounded-md border border-glass-border bg-background px-2 text-sm"
        >
          {plans.length === 0 && <option value="">No plans yet</option>}
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <Button size="sm" variant="outline" onClick={() => create()} aria-label="New plan"><Plus className="h-3.5 w-3.5" />New</Button>
      {active && (
        <>
          <Button size="sm" variant="ghost" onClick={() => duplicate(active.id)} aria-label="Duplicate plan"><Copy className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setName(active.name); setEditing(true); }} aria-label="Rename plan"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => remove(active.id)} aria-label="Delete plan"><Trash2 className="h-3.5 w-3.5" /></Button>
        </>
      )}
    </div>
  );
}

/**
 * Build your own plan: the catalog by category with quantity controls, and the plan's totals recomputed by the engine on every change.
 * Upgrades the model does not cover yet are listed as "Not modeled yet", with no figures.
 */
export function PlanBuilder({ compact = false }: { compact?: boolean }) {
  const catalog = useTwin(selectCatalog);
  const active = useTwin(selectActiveCustomPlan);
  const plans = useTwin(selectVisibleCustomPlans);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const evaluation = useTwin((s) => selectCustomPlanEvaluation(s));
  const add = useTwin((s) => s.addPlanUpgrade);
  const removeItem = useTwin((s) => s.removePlanUpgrade);
  const setQty = useTwin((s) => s.setPlanQuantity);
  const quantities = useMemo(() => new Map(active?.items.map((i) => [i.id, i.quantity ?? null]) ?? []), [active]);
  const planQty = (id: (typeof catalog.items)[number]["id"]) => {
    if (!quantities.has(id)) return null;
    const q = quantities.get(id);
    return q ?? catalog.items.find((i) => i.id === id)?.quantity.default ?? 1;
  };
  const grid = compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-4" data-testid="plan-builder">
      <div className="space-y-2">
        <PlanPicker />
        {active?.copiedFrom && <p className="text-[11px] text-muted-foreground">Started from the AI plan "{active.copiedFrom}".</p>}
      </div>
      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
          Add upgrades below to start a plan, or use "Customize AI plan" on a recommended package.
        </p>
      ) : (
        evaluation && <PlanSummary plan={evaluation} rate={rate} onRemove={(id) => removeItem(id as Parameters<typeof removeItem>[0])} />
      )}

      {CATALOG_CATEGORIES.map((c) => {
        const items = catalog.items.filter((i) => i.category === c.id);
        const experimental = catalog.experimental.filter((x) => x.category === c.id);
        if (!items.length && !experimental.length) return null;
        return (
          <section key={c.id} aria-label={c.label} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</h3>
            <div className={grid}>
              {items.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  planQuantity={planQty(item.id)}
                  onAdd={(q) => add(item.id, item.quantity.kind === "whole" ? undefined : q)}
                  onRemove={() => removeItem(item.id)}
                  onQuantity={(q) => setQty(item.id, q)}
                />
              ))}
              {experimental.map((x) => (
                <article key={x.id} className="flex min-w-0 flex-col rounded-xl border border-dashed border-glass-border p-3 text-sm opacity-70" aria-label={`${x.label} (not modeled yet)`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden><FlaskConical className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <h4 className="font-medium leading-tight">{x.label}</h4>
                      <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px] font-normal">Not modeled yet</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{x.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{x.reason}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
