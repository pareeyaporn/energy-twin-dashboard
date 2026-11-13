import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdvisorMessageExtras } from "./AdvisorMessageExtras";
import { PORTFOLIO_SUGGESTED_QUESTIONS, useAdvisorUi } from "./uiStore";

/**
 * "Ask about the portfolio": a chat dialog on the portfolio page (docs/23). Questions go to the same advisor with the portfolio tools
 * (portfolio_overview, portfolio_optimize), so a question can chain them: rank the hotels, then split a budget. Every number in an
 * answer comes from the engine's results.
 */
export function PortfolioChat() {
  const open = useAdvisorUi((s) => s.portfolioChatOpen);
  const setOpen = useAdvisorUi((s) => s.setPortfolioChatOpen);
  const { messages, busy, step, ask } = useTwin(
    useShallow((s) => ({ messages: s.advisorMessages, busy: s.advisorBusy, step: s.advisorStep, ask: s.askAdvisor })),
  );
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const list = messages.filter((m) => m.scope === "portfolio");
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, list.length, busy]);
  const send = (text: string) => {
    if (busy || !text.trim()) return;
    setQ("");
    void ask(text, { scope: "portfolio" });
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="portfolio-chat-open">
        <MessagesSquare /> Ask about the portfolio
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[min(720px,calc(100vw-16px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none" data-testid="portfolio-chat">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
            <DialogTitle>Ask about the portfolio</DialogTitle>
            <DialogDescription>
              The AI asks the engine to rank the hotels or split a budget, then explains the results. Modeled estimates; synthetic hotels are labeled synthetic.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite" aria-busy={busy}>
            {list.length === 0 && !busy && <p className="text-sm text-muted-foreground">Ask which hotel to start with, or how to split a budget across the chain.</p>}
            {list.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-1"}>
                {m.role === "user" ? (
                  <p className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm" data-testid="portfolio-chat-answer">{m.text}</p>
                    <p className="text-[11px] text-muted-foreground">{m.source === "ai" ? "Explains the computed results" : "Template answer from the computed results"}</p>
                    <AdvisorMessageExtras message={m} />
                  </>
                )}
              </div>
            ))}
            {busy && (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> {step ?? "Thinking…"}
              </p>
            )}
            <div ref={end} />
          </div>
          <div className="shrink-0 space-y-2 border-t border-border px-4 py-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(q);
              }}
            >
              <label className="sr-only" htmlFor="portfolio-chat-input">Ask about the portfolio</label>
              <input
                id="portfolio-chat-input"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                placeholder="Ask about the hotel chain…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" size="sm" disabled={busy || !q.trim()} aria-label="Send question">
                <Send />
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
              {PORTFOLIO_SUGGESTED_QUESTIONS.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => send(s)} className="rounded-md border border-border px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-50" data-testid="portfolio-chat-suggestion">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
