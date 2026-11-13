import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Trash2 } from "lucide-react";
import { advisor } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectIsSynthetic } from "@/store/hotelDerived";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AdvisorMessageExtras } from "@/advisor/AdvisorMessageExtras";

export function AdvisorPanel() {
  const { messages, busy, step, ask, clear, synthetic, hotelName } = useTwin(
    useShallow((s) => ({
      messages: s.advisorMessages,
      busy: s.advisorBusy,
      step: s.advisorStep,
      ask: s.askAdvisor,
      clear: s.clearAdvisor,
      synthetic: selectIsSynthetic(s),
      hotelName: s.hotel.profile.name,
    })),
  );
  const [question, setQuestion] = useState("");
  const send = (text: string) => {
    if (busy || !text.trim()) return;
    setQuestion("");
    void ask(text);
  };

  return (
    <section aria-label="AI advisor" className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">AI advisor</h2>
          {/* Sidebar redesign (at the user's request): the context the answers use, in one line (the briefing stays on the Hotel step). */}
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="advisor-context">
            About {hotelName}{synthetic ? " · Synthetic demo data" : ""} · explains the model's results
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || messages.length === 0}
          onClick={clear}
        >
          <Trash2 />
          Clear
        </Button>
      </header>
      <Conversation aria-label="Advisor conversation" className="min-h-0" aria-busy={busy}>
        <ConversationContent className="gap-5">
          {messages.length === 0 && !busy && (
            <ConversationEmptyState title="Energy Twin advisor" description="Ask about costs, upgrades, risks or what-ifs, or pick a suggested question below. Answers explain the model's numbers; they never invent new ones." />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role === "user" ? "user" : "assistant"}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : undefined
                }
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                ) : (
                  <MessageResponse mode="static" plugins={{}} className="whitespace-pre-wrap break-words">
                    {message.text}
                  </MessageResponse>
                )}
              </MessageContent>
              {message.role === "advisor" && message.source && (
                <p className="text-[11px] text-muted-foreground">
                  {message.source === "ai" ? "Explains the computed results" : "Template answer"}
                </p>
              )}
              <AdvisorMessageExtras message={message} />
            </Message>
          ))}
          {busy && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="motion-reduce:animate-none">{step ?? "Thinking…"}</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to latest answer" />
      </Conversation>
      <div className="shrink-0 border-t border-border p-4">
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputTextarea
            aria-label="Ask the advisor"
            placeholder="Ask about your hotel…"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={busy}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              aria-label="Send question"
              title="Send question"
              status={busy ? "submitted" : "ready"}
              disabled={busy || !question.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {advisor.ADVISOR_SUGGESTED_QUESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto max-w-full whitespace-normal rounded-md px-2.5 py-1.5 text-left text-xs"
              disabled={busy}
              onClick={() => send(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
