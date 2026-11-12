/** Presentation-only terminology bridge for the unchanged legacy sample data. */
export function hotelWording(text: string): string {
  return text
    .replace(/Maya(?:['’]s)?\s+house/gi, "Sample profile (synthetic)")
    .replace(/\bMaya\b/gi, "Hotel")
    .replace(/\bhomeowners?\b/gi, "hotel operator")
    .replace(/\battic\b/gi, "roof space")
    .replace(/\bfurnace\b/gi, "heating unit")
    .replace(/\bhomes\b/gi, "buildings")
    .replace(/\bhome\b/gi, "building")
    .replace(/\bhouses\b/gi, "buildings")
    .replace(/\bhouse\b/gi, "building");
}