import { defineTool } from "@lovable.dev/mcp-js";
import presets from "@/data/hotel/presets.json";

export default defineTool({
  name: "list_hotel_presets",
  title: "List synthetic hotel demos",
  description: "List the app's synthetic hotel preset catalog, not a user's current profile or saved scenarios.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: presets.map((p) => `${p.id}: ${p.label} · Synthetic demo data`).join("\n") }] }),
});