import type { UpgradeId } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed } from "@/store/hotelDerived";

/** Short names for the chips under the diagram. */
export const UPGRADE_SHORT: Record<UpgradeId, string> = {
  insulation: "Roof insulation",
  led_lighting: "LED lighting",
  occupancy_sensors: "Occupancy sensors",
  smart_room_controls: "Smart room controls",
  energy_management: "Energy management",
  hvac_upgrade: "HVAC equipment",
  water_heating: "Water heating",
  rooftop_solar_quarter: "Solar (quarter roof)",
  rooftop_solar_half: "Solar (half roof)",
  rooftop_solar: "Rooftop solar",
};

/** The upgrades of the applied package, or an empty list. */
function useInstalled(): UpgradeId[] {
  const d = useTwin(selectDisplayed);
  return d.package ? d.package.evaluation.upgradeIds : [];
}

/** SVG glyphs drawn on the building for each installed upgrade ("ghost" upgrades). Place inside the diagram's <svg>. */
export function GhostUpgradeOverlay() {
  const installed = useInstalled();
  const has = (id: UpgradeId) => installed.includes(id);
  return (
    <g data-testid="ghost-upgrades" pointerEvents="none">
      {has("insulation") && (
        <g data-upgrade="insulation">
          <title>Roof insulation</title>
          <line x1="86" y1="22" x2="554" y2="22" stroke="var(--savings)" strokeWidth="5" strokeDasharray="10 5" />
        </g>
      )}
      {(has("rooftop_solar") || has("rooftop_solar_half") || has("rooftop_solar_quarter")) && (
        <g data-upgrade="rooftop_solar">
          <title>Rooftop solar</title>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={150 + i * 60} y="6" width="48" height="12" rx="2" fill="var(--efficient)" stroke="var(--savings)" strokeWidth="1.5" />
          ))}
        </g>
      )}
      {has("energy_management") && (
        <g data-upgrade="energy_management">
          <title>Energy management controls</title>
          <rect x="100" y="34" width="26" height="22" rx="3" fill="none" stroke="var(--savings)" strokeWidth="2" />
          <path d="M105 52 v-8 M111 52 v-12 M117 52 v-5 M123 52 v-10" stroke="var(--savings)" strokeWidth="2" />
        </g>
      )}
      {has("hvac_upgrade") && (
        <g data-upgrade="hvac_upgrade">
          <title>High-efficiency HVAC equipment</title>
          <rect x="504" y="34" width="36" height="26" rx="3" fill="none" stroke="var(--savings)" strokeWidth="2" />
          <circle cx="522" cy="47" r="8" fill="none" stroke="var(--savings)" strokeWidth="2" />
          <path d="M522 39 v16 M514 47 h16" stroke="var(--savings)" strokeWidth="1.5" />
        </g>
      )}
      {has("smart_room_controls") && (
        <g data-upgrade="smart_room_controls">
          <title>Smart room controls</title>
          {[0, 1, 2].flatMap((row) =>
            [0, 1].map((col) => (
              <g key={`${row}-${col}`} transform={`translate(${col === 0 ? 100 : 512} ${112 + row * 50})`}>
                <rect width="16" height="20" rx="3" fill="none" stroke="var(--savings)" strokeWidth="2" />
                <circle cx="8" cy="8" r="3.5" fill="var(--savings)" />
              </g>
            )),
          )}
        </g>
      )}
      {has("led_lighting") && (
        <g data-upgrade="led_lighting">
          <title>LED lighting</title>
          {[130, 170, 210, 250, 380, 420, 460, 500].map((x) => (
            <circle key={x} cx={x} cy="270" r="4" fill="var(--heat)" opacity="0.95" />
          ))}
          {[108, 160, 204, 264, 316].map((y) => (
            <circle key={y} cx="320" cy={y} r="3.5" fill="var(--heat)" />
          ))}
          {[120, 170, 240, 280].map((x) => (
            <circle key={x} cx={x} cy="296" r="4" fill="var(--heat)" />
          ))}
        </g>
      )}
      {has("occupancy_sensors") && (
        <g data-upgrade="occupancy_sensors">
          <title>Occupancy sensors</title>
          {[130, 200, 270].map((y) => (
            <g key={y}>
              <circle cx="320" cy={y} r="7" fill="none" stroke="var(--savings)" strokeWidth="2" />
              <circle cx="320" cy={y} r="2.5" fill="var(--savings)" />
            </g>
          ))}
        </g>
      )}
      {has("water_heating") && (
        <g data-upgrade="water_heating">
          <title>High-efficiency water heating</title>
          <path d="M120 400 q8 -16 0 -26 q-8 10 0 26 z" fill="var(--savings)" />
          <path d="M520 400 q8 -16 0 -26 q-8 10 0 26 z" fill="var(--savings)" />
        </g>
      )}
    </g>
  );
}

/** Chips naming what is installed in the current view. */
export function InstalledUpgrades() {
  const installed = useInstalled();
  if (installed.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="installed-upgrades">
      <span>Installed in this view:</span>
      {installed.map((id) => (
        <span key={id} className="rounded-full border border-savings/40 bg-savings/10 px-2 py-0.5 text-savings">
          {UPGRADE_SHORT[id]}
        </span>
      ))}
    </p>
  );
}
