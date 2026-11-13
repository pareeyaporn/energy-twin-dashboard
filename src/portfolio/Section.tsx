import type { ReactNode } from "react";

/** A portfolio page section heading: optional eyebrow (the step in the page's story), title, one-line subtitle, actions on the right. */
export function SectionHeading({ id, eyebrow, title, subtitle, actions }: { id?: string; eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h2 id={id} className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A small "Estimate" label, the same on every modeled figure. */
export function EstimateBadge({ label = "Estimate" }: { label?: string }) {
  return <span className="rounded-full border border-glass-border px-1.5 py-px text-[10px] font-normal leading-tight text-muted-foreground">{label}</span>;
}

/** Scrolls to a `data-anchor` section, smoothly unless effects are reduced (the app setting or the system's reduced-motion preference). */
export function scrollToAnchor(anchor: string, reduceEffects: boolean): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector(`[data-anchor="${anchor}"]`);
  if (!el) return false;
  const systemReduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduceEffects || systemReduce ? "auto" : "smooth" });
  return true;
}
