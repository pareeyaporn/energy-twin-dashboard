<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- All app state lives in one zustand store (`src/store/useTwin.ts`); displayed costs/savings come from store selectors, never hard-coded in components, so mock data can be swapped for real calculations.
- Mock data lives in `src/data/*.json`; `src/engine` (calculations) and `src/three` (3D) are reserved for code the owner adds later — don't add logic there.
- Zustand selectors that return new objects must be wrapped in `useShallow` to avoid render loops.
- The index page renders one CSS-responsive workspace tree, so stage popovers are not duplicated and hydration never swaps desktop/mobile trees.
- Translate legacy sample terminology only at the presentation boundary with `src/lib/presentation.ts`; keep underlying data and calculations unchanged during UI-only wording updates.
- Hotel profile controls display resolved `hotel.profile` values and commit optional input patches through `setHotelInput`; nested temperature resets preserve other explicit setpoints because the store clears only top-level keys.
- The Overview is a separate content route reading `selectDisplayed`, `selectZoneRows`, and `selectOpportunities`; rank unique standalone upgrades by their supplied whole-hotel savings to avoid double-counting zone entries.
- Place the owner-managed `HotelTwin` unchanged inside Stage; use stage container queries for zone details beside or below the diagram, and keep legacy stage overlays unmounted to avoid duplicate controls and costs.
- Budget optimizer views share hotel actions and package presentation; never recalculate financial values in UI, label net benefit with the result's actual horizon, and delay winner application by 600ms without overriding manual selection.
- The advisor panel uses AI Elements and the existing store actions; preserve returned text and source labels without adding inference, error messages, or fallback logic in the UI.
- Prebundle lazy panel dependencies and React together in Vite's optimizeDeps include list to prevent late discovery replacing React chunks beneath mounted components.
- The dashboard is one workspace: a four-tab left panel reusing existing components through variant props (ScenarioSimulator panel, BudgetOptimizer workspace, HomePanel presetOnly) beside an always-visible Stage with a selectCompare KPI strip; full pages stay on their own routes.
- Budget editors retain transient text locally and commit valid amounts only on blur/Enter; an empty draft preserves the stored budget, so typing never triggers intermediate optimizations.
- Render default provenance from resolved profile metadata and use plugin-free advisor text rendering to avoid shipping unused document-rendering bundles.
