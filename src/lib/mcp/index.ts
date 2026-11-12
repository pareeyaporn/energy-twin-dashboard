import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listHotelPresets from "./tools/list-hotel-presets";
import listStressTests from "./tools/list-stress-tests";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "energy-twin-dashboard",
  title: "Energy Twin Dashboard",
  version: "0.1.0",
  instructions: "Read synthetic hotel demos and simulated stress-test definitions. All data is synthetic, not monitored or engineering-grade. Current profiles, results, advisor conversations and saved scenarios live only in the user's browser tab and are not available through this remote server. Browser tools on the Scenario page can read the visible comparison and select a stress test.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listHotelPresets, listStressTests],
});