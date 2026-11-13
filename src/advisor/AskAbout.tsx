import { Sparkles } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { openWorkspaceTab } from "@/tour/dom";
import type { advisor } from "@/engine/hotel";
import { useAdvisorUi } from "./uiStore";

/**
 * "Ask AI about this": a small button next to a figure or card. On the hotel dashboard it opens the Ask tab and asks the question; on
 * the portfolio page (scope "portfolio") it opens the portfolio chat. The answer goes through the same tools and number check as any
 * other question (docs/23).
 */
export function AskAbout({
  question,
  scope = "hotel",
  label = "Ask AI",
  className = "",
}: {
  question: string;
  scope?: advisor.AdvisorScope;
  label?: string;
  className?: string;
}) {
  const ask = useTwin((s) => s.askAdvisor);
  const busy = useTwin((s) => s.advisorBusy);
  const openChat = useAdvisorUi((s) => s.setPortfolioChatOpen);
  const go = () => {
    if (scope === "portfolio") openChat(true);
    else openWorkspaceTab("Ask");
    void ask(question, { scope });
  };
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      title={`Ask the AI advisor: ${question}`}
      aria-label={`${label || "Ask AI"}: ${question}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      data-testid="ask-about"
    >
      <Sparkles className="size-3" aria-hidden />{label ? ` ${label}` : null}
    </button>
  );
}
