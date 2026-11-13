import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, Download, FileSpreadsheet, Pencil, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import {
  calculateBaselineEnergy,
  emptyGridRow,
  guessMapping,
  mappingComplete,
  parseCsvText,
  recordsToGrid,
  resolveProfile,
  sampleUtilityBills,
  tableToGrid,
  validateGrid,
  SAMPLE_YEAR,
} from "@/engine/hotel";
import type { ColumnMapping, ElecUnit, GasUnit, GridMode, UtilityField, UtilityGridRow } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTwin } from "@/store/useTwin";
import { selectUtilityKey, selectUtilitySet } from "@/store/hotelDerived";
import { PROVENANCE_LABEL, withoutUtility } from "@/store/utilityData";
import type { UtilityProvenance } from "@/store/utilityData";
import { SpreadsheetGrid } from "./SpreadsheetGrid";
import { CalibrationReview } from "./CalibrationReview";

type Source = "sample" | "upload" | "manual";
type Step = "edit" | "map" | "review";

interface Draft {
  rows: UtilityGridRow[];
  mode: GridMode;
  year: number;
  provenance: UtilityProvenance;
  markedActual: boolean;
  useBillRates: boolean;
  fileName?: string;
}

const MONTHS12 = () => Array.from({ length: 12 }, (_, m) => emptyGridRow(m));
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const int = (n: number) => Math.round(n).toLocaleString("en-US");
const YEARS = Array.from({ length: 8 }, (_, i) => 2026 - i);
const FIELD_LABEL: Record<UtilityField, string> = {
  month: "Month",
  year: "Billing year",
  start: "Start date",
  end: "End date",
  elecUse: "Electricity use",
  elecCost: "Electricity cost ($)",
  gasUse: "Natural gas use",
  gasCost: "Gas cost ($)",
  ignore: "Not used",
};

function toPeriods(rows: UtilityGridRow[], year: number): UtilityGridRow[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  return rows
    .filter((r) => r.month !== null && (r.elecKWh || r.gasTherms || r.elecCost || r.gasCost))
    .map((r) => {
      const m = r.month!;
      const end = m === 11 ? `${year + 1}-01-01` : `${year}-${pad(m + 2)}-01`;
      return { ...r, start: r.start || `${year}-${pad(m + 1)}-01`, end: r.end || end };
    });
}
function toMonthly(rows: UtilityGridRow[]): UtilityGridRow[] {
  return Array.from({ length: 12 }, (_, m) => {
    const r = rows.find((x) => x.month === m);
    return r ? { ...r, start: "", end: "" } : emptyGridRow(m);
  });
}

/** The Utility Data Manager: sample, upload or manual records in a spreadsheet, checked before they are saved; then the comparison. */
export function UtilityDataManager({ open, onOpenChange, initialStep = "edit" }: { open: boolean; onOpenChange: (b: boolean) => void; initialStep?: Step }) {
  const name = useTwin((s) => s.hotel.profile.name);
  const hotelInput = useTwin((s) => s.hotelInput);
  const key = useTwin(selectUtilityKey);
  const saved = useTwin(selectUtilitySet);
  const save = useTwin((s) => s.saveUtilityData);
  const remove = useTwin((s) => s.removeUtilityData);

  // The sample: synthetic bills from this hotel's own modeled baseline (never its calibrated one).
  const sample = useMemo(() => {
    const p = resolveProfile(withoutUtility(hotelInput));
    return recordsToGrid(sampleUtilityBills(p.profile, calculateBaselineEnergy(p)), "monthly");
  }, [hotelInput]);
  const sampleDraft = (): Draft => ({ rows: sample.map((r) => ({ ...r })), mode: "monthly", year: SAMPLE_YEAR, provenance: "sample", markedActual: false, useBillRates: false });
  const savedDraft = (): Draft | null =>
    saved ? { rows: recordsToGrid(saved.records, saved.mode), mode: saved.mode, year: saved.year, provenance: saved.provenance, markedActual: saved.markedActual, useBillRates: saved.useBillRates, ...(saved.fileName ? { fileName: saved.fileName } : {}) } : null;

  const [step, setStep] = useState<Step>(initialStep);
  const [source, setSource] = useState<Source>("sample");
  const [draft, setDraft] = useState<Draft>(() => savedDraft() ?? sampleDraft());
  const [history, setHistory] = useState<Draft[]>([]);
  const [confirm, setConfirm] = useState<null | { message: string; run: () => void }>(null);
  const [upload, setUpload] = useState<null | { fileName: string; table: string[][]; mapping: ColumnMapping; questions: string[]; sheet?: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [baseline, setBaselineDraft] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Opening starts from what is saved (or the sample), on the requested step.
  useEffect(() => {
    if (!open) return;
    const d = savedDraft() ?? sampleDraft();
    setDraft(d);
    setBaselineDraft(JSON.stringify(d));
    setHistory([]);
    setSource(saved ? (saved.provenance === "uploaded" ? "upload" : saved.provenance === "user_entered" ? "manual" : "sample") : "sample");
    setStep(saved ? initialStep : "edit");
    setUpload(null);
    setProblem(null);
    setConfirm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const check = useMemo(() => validateGrid(draft.rows, draft.mode), [draft.rows, draft.mode]);
  const dirty = JSON.stringify(draft) !== baseline;

  const change = (patch: Partial<Draft>) => {
    setHistory((h) => [...h.slice(-49), draft]);
    setDraft((d) => {
      const next = { ...d, ...patch };
      // Editing the sample makes it edited sample data (still synthetic).
      if (patch.rows && next.provenance === "sample") next.provenance = "sample_edited";
      return next;
    });
  };
  const undo = () => {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setDraft(prev);
      return h.slice(0, -1);
    });
  };
  const guard = (message: string, run: () => void) => (dirty ? setConfirm({ message, run }) : run());

  const chooseSource = (s: Source) => {
    if (s === source && s !== "upload") return;
    if (s === "upload") {
      fileRef.current?.click();
      return;
    }
    guard(s === "sample" ? "Load the sample data? Unsaved changes will be lost." : "Start a blank spreadsheet? Unsaved changes will be lost.", () => {
      setSource(s);
      setHistory([]);
      setDraft(s === "sample" ? sampleDraft() : { rows: MONTHS12(), mode: "monthly", year: SAMPLE_YEAR, provenance: "user_entered", markedActual: true, useBillRates: false });
      setStep("edit");
    });
  };

  const readFile = async (file: File) => {
    setProblem(null);
    setBusy("Reading the file…");
    try {
      let table: string[][];
      let sheet: string | undefined;
      if (/\.xlsx$/i.test(file.name)) {
        const { readWorkbook } = await import("./excel");
        const wb = await readWorkbook(await file.arrayBuffer());
        table = wb.rows;
        sheet = wb.sheet;
      } else if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
        table = parseCsvText(await file.text());
      } else {
        throw new Error("Only Excel (.xlsx) and CSV (.csv) files are supported.");
      }
      if (table.length < 2) throw new Error("The file needs a header row and at least one row of data.");
      const g = guessMapping(table[0]!);
      setUpload({ fileName: file.name, table, mapping: g.mapping, questions: g.questions, ...(sheet ? { sheet } : {}) });
      setStep("map");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The file could not be read.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importMapped = () => {
    if (!upload || !mappingComplete(upload.mapping)) return;
    const g = tableToGrid(upload.table.slice(1), upload.mapping);
    const usesDates = upload.mapping.columns.includes("start") && upload.mapping.columns.includes("end") && g.rows.some((r) => r.start && r.end);
    guard("Replace the spreadsheet with the uploaded file? Unsaved changes will be lost.", () => {
      setSource("upload");
      setHistory([]);
      setDraft({
        rows: usesDates ? g.rows : toMonthly(g.rows.map((r) => ({ ...r, start: "", end: "" }))),
        mode: usesDates ? "periods" : "monthly",
        year: g.year ?? SAMPLE_YEAR,
        provenance: "uploaded",
        markedActual: true,
        useBillRates: false,
        fileName: upload.fileName,
      });
      setUpload(null);
      setStep("edit");
    });
  };

  const downloadTemplate = async () => {
    setBusy("Preparing the template…");
    try {
      const { buildTemplate } = await import("./excel");
      const blob = await buildTemplate(draft.year, sample);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "EnergyTwin_UtilityData_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setProblem("The template could not be created in this browser.");
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    if (!check.canApply) return;
    save(key, {
      records: check.records,
      provenance: draft.provenance,
      markedActual: draft.provenance === "sample" ? false : draft.markedActual,
      year: draft.year,
      mode: draft.mode,
      useBillRates: draft.useBillRates,
      ...(draft.fileName ? { fileName: draft.fileName } : {}),
    });
    setBaselineDraft(JSON.stringify(draft));
    setStep("review");
  };

  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (dirty && step !== "review") setConfirm({ message: "Discard unsaved changes?", run: () => onOpenChange(false) });
    else onOpenChange(false);
  };

  // Live summary
  const t = check.records.reduce(
    (a, r) => ({ kwh: a.kwh + (r.elecKWh ?? 0), therms: a.therms + (r.gasTherms ?? 0), ec: a.ec + (r.elecCost ?? 0), gc: a.gc + (r.gasCost ?? 0) }),
    { kwh: 0, therms: 0, ec: 0, gc: 0 },
  );
  const billsWithCost = check.records.filter((r) => r.elecCost !== undefined || r.gasCost !== undefined).length;
  const errors = check.issues.filter((x) => x.level === "error");
  const warnings = check.issues.filter((x) => x.level === "warning");
  const synthetic = draft.provenance === "sample" || (draft.provenance === "sample_edited" && !draft.markedActual);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[94vh] w-[min(1100px,calc(100vw-16px))] max-w-none flex-col gap-3 overflow-hidden p-4 sm:p-6" data-testid="utility-manager">
        <DialogHeader>
          <DialogTitle>Utility Data Manager — {name}</DialogTitle>
          <DialogDescription>
            Use 12 months of electricity and gas bills to check and calibrate the model. Data stays in this browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Start from" className="flex flex-wrap gap-1 rounded-xl border border-glass-border p-1">
            {([
              ["sample", "Edit sample", Sparkles],
              ["upload", "Upload Excel / CSV", Upload],
              ["manual", "Enter manually", Pencil],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={source === id && step !== "review"}
                onClick={() => chooseSource(id)}
                data-testid={`source-${id}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${source === id && step !== "review" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <Button size="sm" variant={step === "review" ? "secondary" : "outline"} onClick={() => guard("Leave the editor? Unsaved changes will be lost.", () => setStep("review"))} data-testid="go-review">
                Compare & calibrate
              </Button>
            )}
            {step === "review" && (
              <Button size="sm" variant="outline" onClick={() => setStep("edit")}>
                Edit data
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" data-testid="utility-file" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
        </div>

        {confirm && (
          <div role="alertdialog" aria-label="Confirm" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-sm">
            <span className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-400" />{confirm.message}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep editing</Button>
              <Button size="sm" variant="destructive" onClick={() => { const run = confirm.run; setConfirm(null); run(); }} data-testid="confirm-discard">Discard</Button>
            </span>
          </div>
        )}
        {busy && <p role="status" className="text-xs text-muted-foreground">{busy}</p>}
        {problem && <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"><CircleAlert className="size-4" />{problem}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {step === "map" && upload && (
            <section className="space-y-3" aria-label="Map columns" data-testid="column-mapping">
              <p className="text-sm">
                <FileSpreadsheet className="mr-1 inline size-4 text-primary" />
                <strong>{upload.fileName}</strong>{upload.sheet ? ` · sheet "${upload.sheet}"` : ""} · {upload.table.length - 1} rows. Check what each column holds{mappingComplete(upload.mapping) ? "." : ", and answer the questions below."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {upload.table[0]!.map((h, i) => (
                  <label key={i} className="rounded-lg border border-border p-2 text-xs">
                    <span className="block truncate font-medium" title={h}>{h || `Column ${i + 1}`}</span>
                    <span className="block truncate text-muted-foreground">e.g. {upload.table[1]?.[i] || "—"}</span>
                    <select
                      className="mt-1 w-full rounded border border-input bg-background px-1 py-1"
                      value={upload.mapping.columns[i]}
                      onChange={(e) => {
                        const columns = upload.mapping.columns.map((c, j) => (j === i ? (e.target.value as UtilityField) : c === e.target.value && e.target.value !== "ignore" ? "ignore" : c));
                        setUpload({ ...upload, mapping: { ...upload.mapping, columns } });
                      }}
                      data-testid={`map-${i}`}
                    >
                      {(Object.keys(FIELD_LABEL) as UtilityField[]).map((f) => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {upload.mapping.columns.includes("elecUse") && (
                  <label>Electricity unit{" "}
                    <select className="rounded border border-input bg-background px-1 py-1" value={upload.mapping.elecUnit ?? ""} onChange={(e) => setUpload({ ...upload, mapping: { ...upload.mapping, elecUnit: (e.target.value || null) as ElecUnit | null } })} data-testid="elec-unit">
                      <option value="">Choose…</option><option value="kWh">kWh</option><option value="MWh">MWh</option>
                    </select>
                  </label>
                )}
                {upload.mapping.columns.includes("gasUse") && (
                  <label>Gas unit{" "}
                    <select className="rounded border border-input bg-background px-1 py-1" value={upload.mapping.gasUnit ?? ""} onChange={(e) => setUpload({ ...upload, mapping: { ...upload.mapping, gasUnit: (e.target.value || null) as GasUnit | null } })} data-testid="gas-unit">
                      <option value="">Choose…</option><option value="therms">therms</option><option value="CCF">CCF (×1.037)</option><option value="Mcf">Mcf (×10.37)</option><option value="MMBtu">MMBtu (×10)</option><option value="Dth">Dth (×10)</option>
                    </select>
                  </label>
                )}
              </div>
              {!mappingComplete(upload.mapping) && <ul className="list-disc space-y-1 pl-5 text-xs text-amber-400">{upload.questions.map((q) => <li key={q}>{q}</li>)}{upload.questions.length === 0 && <li>Map a month (or start and end dates) and at least one use column, with its unit.</li>}</ul>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setUpload(null); setStep("edit"); }}>Cancel upload</Button>
                <Button disabled={!mappingComplete(upload.mapping)} onClick={importMapped} data-testid="import-mapped">Review in spreadsheet</Button>
              </div>
            </section>
          )}

          {step === "edit" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`rounded-full border px-2 py-0.5 ${synthetic ? "border-heat/40 text-heat" : "border-primary/40 text-primary"}`} data-testid="draft-provenance">
                  {PROVENANCE_LABEL[draft.provenance]}{draft.fileName ? ` · ${draft.fileName}` : ""}
                </span>
                <label className="flex items-center gap-1">Billing year
                  <select className="rounded border border-input bg-background px-1 py-0.5" value={draft.year} onChange={(e) => change({ year: Number(e.target.value) })} data-testid="billing-year">
                    {[...new Set([draft.year, ...YEARS])].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={draft.mode === "periods"} onChange={(e) => change({ mode: e.target.checked ? "periods" : "monthly", rows: e.target.checked ? toPeriods(draft.rows, draft.year) : toMonthly(draft.rows) })} data-testid="toggle-periods" />
                  Billing periods (start and end dates)
                </label>
                {draft.mode === "periods" && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => change({ rows: [...draft.rows, emptyGridRow()] })} data-testid="add-row"><Plus />Add bill</Button>
                )}
                <Button size="sm" variant="ghost" className="h-7" onClick={undo} disabled={!history.length} aria-label="Undo the last edit (Ctrl+Z)"><RotateCcw />Undo</Button>
              </div>

              <SpreadsheetGrid rows={draft.rows} mode={draft.mode} issues={check.issues} onChange={(rows) => change({ rows })} onUndo={undo} onRemoveRow={(i) => change({ rows: draft.rows.filter((_, j) => j !== i) })} />

              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7" aria-label="Totals" data-testid="utility-summary">
                {[
                  ["Electricity", `${int(t.kwh)} kWh`],
                  ["Natural gas", `${int(t.therms)} therms`],
                  ["Electricity spend", usd(t.ec)],
                  ["Gas spend", usd(t.gc)],
                  ["Combined spend", usd(t.ec + t.gc)],
                  ["Average per bill", billsWithCost ? usd((t.ec + t.gc) / billsWithCost) : "—"],
                  ["Coverage", `${check.coverage.elec.bills || check.coverage.gas.bills} bills · ${Math.max(check.coverage.elec.days, check.coverage.gas.days)} days`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-glass-border p-2"><dt className="text-muted-foreground">{k}</dt><dd className="num font-medium" data-testid={`sum-${k}`}>{v}</dd></div>
                ))}
              </dl>
              <p className={`text-xs ${check.coverage.elec.complete || check.coverage.gas.complete ? "text-savings" : "text-amber-400"}`} data-testid="coverage-note">
                {check.coverage.elec.complete && check.coverage.gas.complete
                  ? "Complete: 12 months of electricity and gas, enough to calibrate both."
                  : check.coverage.elec.complete || check.coverage.gas.complete
                    ? `Complete for ${check.coverage.elec.complete ? "electricity" : "gas"} only; the other fuel will be compared but not calibrated.`
                    : "Incomplete: fewer than 12 months. The bills can be saved and compared, but the model will not be calibrated."}
              </p>

              {(errors.length > 0 || warnings.length > 0) && (
                <details open={errors.length > 0} className="rounded-lg border border-border p-2 text-xs" data-testid="utility-issues">
                  <summary className="cursor-pointer">
                    <span className={errors.length ? "text-destructive" : ""}>{errors.length} error{errors.length === 1 ? "" : "s"}</span> (must be fixed) · <span className="text-amber-400">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</span> (allowed)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {[...errors, ...warnings].map((x, i) => <li key={i} className={x.level === "error" ? "text-destructive" : "text-amber-400"}>{x.message}</li>)}
                  </ul>
                </details>
              )}

              <div className="flex flex-wrap gap-4 text-xs">
                {(draft.provenance === "sample" || draft.provenance === "sample_edited") && (
                  <label className="flex items-start gap-1.5">
                    <input type="checkbox" checked={draft.markedActual} disabled={draft.provenance === "sample"} onChange={(e) => change({ markedActual: e.target.checked })} data-testid="mark-actual" />
                    <span>These are my hotel's real utility records {draft.provenance === "sample" ? "(edit the sample first; unedited sample data is always synthetic)" : "(otherwise they stay labeled synthetic)"}</span>
                  </label>
                )}
                <label className="flex items-start gap-1.5">
                  <input type="checkbox" checked={draft.useBillRates} onChange={(e) => change({ useBillRates: e.target.checked })} data-testid="use-bill-rates" />
                  <span>Use my bills' average rates (cost ÷ use) instead of the state averages</span>
                </label>
              </div>
            </div>
          )}

          {step === "review" && <CalibrationReview />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void downloadTemplate()} data-testid="download-template"><Download />Download Excel template</Button>
            {step === "edit" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => guard("Restore the sample data? Unsaved changes will be lost.", () => { setSource("sample"); setHistory([]); setDraft(sampleDraft()); })} data-testid="reset-sample"><RotateCcw />Reset sample</Button>
                <Button size="sm" variant="ghost" onClick={() => change({ rows: draft.mode === "periods" ? [emptyGridRow()] : MONTHS12() })} data-testid="clear-data"><Trash2 />Clear</Button>
              </>
            )}
            {saved && step === "review" && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm({ message: "Remove this hotel's utility data and go back to the modeled baseline?", run: () => { remove(key); onOpenChange(false); } })} data-testid="remove-data"><Trash2 />Remove data</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => close(false)} data-testid="utility-cancel">{step === "review" ? "Close" : "Cancel"}</Button>
            {step === "edit" && (
              <Button size="sm" onClick={apply} disabled={!check.canApply} data-testid="utility-apply">Apply data</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
