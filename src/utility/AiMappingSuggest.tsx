import { useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { advisor } from "@/engine/hotel";
import type { UtilityField } from "@/engine/hotel";
import { Button } from "@/components/ui/button";

export const MAPPING_FIELDS: readonly UtilityField[] = ["month", "year", "start", "end", "elecUse", "elecCost", "gasUse", "gasCost", "ignore"];
/** Units the AI may see as hints (the same choices as the unit menus); never a value from the file. */
export const MAPPING_UNIT_HINTS = ["kWh", "MWh", "therms", "CCF", "Mcf", "MMBtu", "Dth", "USD"] as const;

/** The AI's header → field suggestion as one field per column (first header wins a field; unknown headers are left as they are). */
export function columnsFromSuggestion(headers: readonly string[], current: readonly UtilityField[], suggestion: Record<string, string>): UtilityField[] {
  const used = new Set<UtilityField>();
  return headers.map((h, i) => {
    const f = suggestion[h] as UtilityField | undefined;
    if (!f || !MAPPING_FIELDS.includes(f)) return current[i] ?? "ignore";
    if (f !== "ignore" && used.has(f)) return "ignore";
    used.add(f);
    return f;
  });
}

/**
 * "Suggest with AI" in the Utility Data Manager's mapping step (docs/19, docs/23). Sends ONLY the column headers and the unit names,
 * never a bill value; shows the suggestion, and changes the mapping only when the user applies it. Without the AI, the automatic
 * mapping (guessMapping) stays.
 */
export function AiMappingSuggest({ headers, columns, labels, onApply }: { headers: readonly string[]; columns: readonly UtilityField[]; labels: Record<UtilityField, string>; onApply: (columns: UtilityField[]) => void }) {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "none" } | { kind: "ready"; columns: UtilityField[] }>({ kind: "idle" });
  const suggest = async () => {
    setState({ kind: "busy" });
    const s = await advisor.suggestColumnMapping(headers, MAPPING_FIELDS, MAPPING_UNIT_HINTS, advisor.getAdvisorConfig());
    if (!s) return setState({ kind: "none" });
    const next = columnsFromSuggestion(headers, columns, s);
    setState(next.some((f, i) => f !== columns[i]) ? { kind: "ready", columns: next } : { kind: "none" });
  };
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2 text-xs" data-testid="ai-mapping">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void suggest()} disabled={state.kind === "busy"} data-testid="ai-mapping-suggest">
          {state.kind === "busy" ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />} Suggest with AI
        </Button>
        <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid="ai-mapping-privacy">
          <ShieldCheck className="size-3.5" aria-hidden /> Sends only the column headers, never your bill values.
        </span>
      </div>
      <div aria-live="polite">
        {state.kind === "none" && <p className="text-muted-foreground" data-testid="ai-mapping-none">No AI suggestion; the automatic mapping above stays. Check each column.</p>}
        {state.kind === "ready" && (
          <div className="space-y-1.5" data-testid="ai-mapping-ready">
            <p className="font-medium">The AI suggests (check before applying):</p>
            <ul className="space-y-0.5">
              {headers.map((h, i) =>
                state.columns[i] !== columns[i] ? (
                  <li key={i}>
                    <span className="font-medium">{h || `Column ${i + 1}`}</span>: {labels[columns[i] ?? "ignore"]} → <span className="text-primary">{labels[state.columns[i] ?? "ignore"]}</span>
                  </li>
                ) : null,
              )}
            </ul>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => { onApply(state.columns); setState({ kind: "idle" }); }} data-testid="ai-mapping-apply">Apply suggestion</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setState({ kind: "idle" })}>Dismiss</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
