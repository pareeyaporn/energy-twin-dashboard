import { StageOverlays } from "./StageOverlays";

export function Stage() {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-stage-gradient">
      <div className="pointer-events-none absolute inset-x-[-30%] bottom-[-20%] h-[70%] stage-grid" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,var(--background)_100%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pb-16">
        <h2 className="text-xl font-semibold text-text-muted">Digital twin</h2>
      </div>
      <StageOverlays />
    </div>
  );
}
