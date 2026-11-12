import { defineTool } from "@lovable.dev/mcp-js";
import { STRESS_TESTS } from "@/engine/hotel";

export default defineTool({
  name: "list_stress_tests",
  title: "List hotel stress tests",
  description: "List available simulated stress tests and descriptions; this does not change a browser scenario.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: STRESS_TESTS.map((test) => `${test.id}: ${test.label} — ${test.description}`).join("\n") }] }),
});