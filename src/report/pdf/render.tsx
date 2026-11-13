// Loaded with a dynamic import when the user generates a report, so react-pdf stays out of the main bundle.
import { pdf } from "@react-pdf/renderer";
import type { ReportData } from "../data";
import { ReportDocument } from "./ReportDocument";

/** A real PDF (selectable text, vector charts) of the report data. */
export async function renderReportPdf(data: ReportData, generated: string): Promise<Blob> {
  return pdf(<ReportDocument data={data} generated={generated} />).toBlob();
}
