import { useState } from "react";
import { Download, Eye, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportFileName } from "./data";
import type { ReportData } from "./data";
import { ReportPreview } from "./ReportPreview";
import { withAiSummary } from "./aiSummary";

const today = () => new Date();
const longDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const subjectOf = (d: ReportData) => (d.kind === "portfolio" ? d.organization : d.hotel.name);

/** Builds the PDF (react-pdf, loaded on demand) and downloads it. The figures are the report data passed in, nothing else. */
export async function downloadReport(data: ReportData, when: Date = today()): Promise<string> {
  const { renderReportPdf } = await import("./pdf/render");
  const blob = await renderReportPdf(data, longDate(when));
  const name = reportFileName(subjectOf(data), when);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return name;
}

/**
 * "Preview report" and "Download PDF report". `getData` is called at click time, so the report always shows the plan on screen at
 * that moment; generating a report reads the results and changes nothing.
 */
export function ReportActions({ getData, label = "Investment summary", compact = false }: { getData: () => ReportData | null; label?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportData | null>(null);

  // The AI executive summary (docs/23) is added before the preview or the PDF when the AI is set up; it waits at most 8 seconds and
  // nothing extra appears if it is slow, fails or quotes a number the report does not hold.
  const [summarizing, setSummarizing] = useState(false);
  const prepare = async (data: ReportData): Promise<ReportData> => {
    if (data.aiSummary) return data;
    setSummarizing(true);
    try {
      return await withAiSummary(data);
    } catch {
      return data;
    } finally {
      setSummarizing(false);
    }
  };
  const openPreview = async (data: ReportData | null) => {
    if (!data || busy) return;
    setBusy(true);
    try {
      setPreview(await prepare(data));
    } finally {
      setBusy(false);
    }
  };

  const download = async (data: ReportData | null) => {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setDone(await downloadReport(await prepare(data)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDF could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5" data-testid="report-actions">
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "items-center"}`}>
        <Button size="sm" variant="accent" className="min-w-0 flex-1 sm:flex-none" disabled={busy} onClick={() => void download(getData())} data-testid="report-download">
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Download />}
          {summarizing ? "Writing summary…" : busy ? "Preparing PDF…" : "Download PDF report"}
        </Button>
        <Button size="sm" variant="outline" className="min-w-0 flex-1 sm:flex-none" disabled={busy} onClick={() => void openPreview(getData())} data-testid="report-preview">
          <Eye /> Preview report
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {error ? (
          <span className="inline-flex items-center gap-1 text-heat" role="alert"><TriangleAlert className="size-3" /> {error} Try again.</span>
        ) : done ? (
          `Downloaded ${done}.`
        ) : (
          `${label}: a multi-page PDF for owners and finance teams, built from these results (modeled estimates).`
        )}
      </p>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[min(920px,calc(100vw-16px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
            <DialogTitle>Report preview</DialogTitle>
            <DialogDescription>The same report data as the PDF; the download below uses exactly these figures.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-2 sm:p-4" data-testid="report-preview-body">
            {preview && <ReportPreview data={preview} />}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button size="sm" variant="outline" onClick={() => setPreview(null)}>Close</Button>
            <Button size="sm" variant="accent" disabled={busy} onClick={() => void download(preview)} data-testid="report-preview-download">
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Download />}
              {busy ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
