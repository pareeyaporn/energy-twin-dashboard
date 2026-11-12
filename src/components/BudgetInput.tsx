import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Transient text stays local; only a complete valid amount reaches the store. */
export function BudgetInput({ id, label, value, disabled, onCommit }: { id: string; label?: string; value: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(money(value));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { if (!editing) setDraft(money(value)); }, [value, editing]);
  const commit = () => {
    const cleaned = draft.replace(/[$,\s]/g, "");
    const amount = Number(cleaned);
    if (!cleaned) { setDraft(money(value)); setInvalid(false); }
    else if (/^\d+(\.\d+)?$/.test(cleaned) && Number.isFinite(amount)) { onCommit(amount); setDraft(money(amount)); setInvalid(false); }
    else { setInvalid(true); setDraft(money(value)); }
    setEditing(false);
  };
  return <div><Input id={id} aria-label={label} inputMode="decimal" className="num" value={draft} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onFocus={() => setEditing(true)} onChange={(event) => { setDraft(event.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />{invalid && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">Enter a valid non-negative budget.</p>}</div>;
}