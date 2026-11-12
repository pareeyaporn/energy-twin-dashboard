import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { advisor } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";

vi.mock("@/components/ai-elements/message", () => ({
  Message: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("Advisor panel actions", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    advisor.clearAdvisorCache();
    advisor.setAdvisorConfig({ endpoint: null, headers: {} });
  });
  afterEach(() => {
    cleanup();
    advisor.setAdvisorConfig(null);
  });

  it("sends the typed question through the store and clears the conversation", async () => {
    render(<AdvisorPanel />);
    fireEvent.change(screen.getByRole("textbox", { name: "Ask the advisor" }), {
      target: { value: "Why is HVAC my biggest cost?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(useTwin.getState().advisorMessages).toHaveLength(2));
    expect(useTwin.getState().advisorMessages[0]?.text).toBe("Why is HVAC my biggest cost?");
    expect(useTwin.getState().advisorMessages[1]?.source).toBe("fallback");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(useTwin.getState().advisorMessages).toEqual([]);
  });

  it.each(advisor.ADVISOR_SUGGESTED_QUESTIONS)(
    "sends the suggestion %s unchanged",
    async (question) => {
      render(<AdvisorPanel />);
      fireEvent.click(screen.getByRole("button", { name: question }));
      await waitFor(() => expect(useTwin.getState().advisorMessages).toHaveLength(2));
      expect(useTwin.getState().advisorMessages[0]?.text).toBe(question);
    },
  );

  it("prevents a second question while the advisor is busy", async () => {
    let finish: ((response: Response) => void) | undefined;
    advisor.setAdvisorConfig({
      endpoint: "https://advisor.test",
      headers: {},
      fetchFn: () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    render(<AdvisorPanel />);
    fireEvent.click(screen.getByRole("button", { name: advisor.ADVISOR_SUGGESTED_QUESTIONS[0] }));
    expect(useTwin.getState().advisorBusy).toBe(true);
    expect(screen.getByRole("textbox", { name: "Ask the advisor" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: advisor.ADVISOR_SUGGESTED_QUESTIONS[1] }));
    expect(useTwin.getState().advisorMessages).toHaveLength(1);
    await act(async () => {
      finish?.(new Response(JSON.stringify({ text: "HVAC serves guest rooms and common areas." })));
    });
    expect(useTwin.getState().advisorBusy).toBe(false);
    expect(useTwin.getState().advisorMessages[1]?.text).toBe(
      "HVAC serves guest rooms and common areas.",
    );
    expect(useTwin.getState().advisorMessages[1]?.source).toBe("ai");
  });
});
