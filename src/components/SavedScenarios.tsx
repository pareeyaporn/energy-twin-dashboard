import { useState } from "react";
import { Check, Pencil, Save, Trash2, X } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SavedScenarios() {
  const savedScenarios = useTwin((s) => s.savedScenarios);
  const hasScenario = useTwin((s) => Object.keys(s.scenario).length > 0 || s.activeStressTest !== null);
  const saveScenario = useTwin((s) => s.saveScenario);
  const loadScenario = useTwin((s) => s.loadScenario);
  const renameScenario = useTwin((s) => s.renameScenario);
  const deleteScenario = useTwin((s) => s.deleteScenario);
  const clearAppliedPackage = useTwin((s) => s.applyHotelPackage);
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const restore = (id: string) => {
    // Scenario charts must show the restored what-if, not a previously applied package.
    clearAppliedPackage(null);
    loadScenario(id);
  };

  return (
    <section className="space-y-4 border-t border-border pt-5" aria-label="Saved scenarios">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Saved scenarios</h2>
          <p className="mt-1 text-xs text-muted-foreground">Saved in this session.</p>
        </div>
        {savedScenarios.length > 0 && <Badge variant="secondary" className="num">{savedScenarios.length}</Badge>}
      </div>

      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (!hasScenario) return; saveScenario(name); setName(""); }}>
        <Label htmlFor="scenario-save-name" className="text-xs">Scenario name <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="scenario-save-name" value={name} maxLength={80} placeholder="e.g. Summer peak" onChange={(event) => setName(event.target.value)} />
        <Button type="submit" variant="accentOutline" className="w-full" disabled={!hasScenario}><Save />Save scenario</Button>
        {!hasScenario && <p className="text-xs text-muted-foreground">Adjust a control or select a stress test before saving.</p>}
      </form>

      {savedScenarios.length === 0 ? <p className="text-sm text-muted-foreground">No saved scenarios yet.</p> : (
        <ul className="space-y-2">
          {savedScenarios.map((saved) => (
            <li key={saved.id} className="rounded-md border border-border bg-background/40 p-3">
              {renamingId === saved.id ? (
                <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); renameScenario(saved.id, renameDraft); setRenamingId(null); }}>
                  <Label htmlFor={`rename-${saved.id}`} className="sr-only">New name for {saved.name}</Label>
                  <Input id={`rename-${saved.id}`} autoFocus value={renameDraft} maxLength={80} onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setRenamingId(null); }} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="accentOutline"><Check />Save name</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingId(null)}><X />Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" title={saved.name}>{saved.name}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => restore(saved.id)} aria-label={`Load ${saved.name}`}>Load</Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRenamingId(saved.id); setRenameDraft(saved.name); }} aria-label={`Rename ${saved.name}`} title="Rename scenario"><Pencil /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { deleteScenario(saved.id); if (renamingId === saved.id) setRenamingId(null); }} aria-label={`Delete ${saved.name}`} title="Delete scenario"><Trash2 /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
