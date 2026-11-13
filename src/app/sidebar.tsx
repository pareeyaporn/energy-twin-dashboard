import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared building blocks of the Hotel Analysis sidebar (the workspace tabs beside the twin): one card style, one section heading and
// one "show more" toggle, so every step reads the same way. Layout only; every figure inside comes from the store.

/** The sidebar's card: one border, one padding, no nested borders inside. */
export const sidebarCard = "min-w-0 rounded-xl border border-border/70 bg-card/60 p-4";

/** Entry animation for content revealed by a toggle (off with reduce effects and prefers-reduced-motion). */
export const reveal = "animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none";

/** A section heading: small icon, title, optional right-hand slot. */
export function SidebarHeading({ icon, title, right, as: Tag = "h2" }: { icon?: ReactNode; title: ReactNode; right?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Tag className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold tracking-tight">
        {icon}
        <span className="min-w-0 truncate">{title}</span>
      </Tag>
      {right}
    </div>
  );
}

/** "View all …" / "Show less": a text button with a chevron; `controls` names the region it opens. */
export function ShowMore({ open, onClick, more, less = "Show less", controls, testId, className }: {
  open: boolean;
  onClick: () => void;
  more: string;
  less?: string;
  controls?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {open ? less : more}
      <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
    </button>
  );
}

/** Compact money for headline figures ($120.2K, $1.4M); the exact value goes in the title. */
export function compactUsd(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}
