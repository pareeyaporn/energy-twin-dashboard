import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { VOICE_STORAGE_KEY, micErrorText, normalizeSpokenQuestion, pickVoice, textForSpeech } from "@/advisor/voice";

describe("voice helpers", () => {
  it("turns spoken numbers into what the advisor's parser reads", () => {
    expect(normalizeSpokenQuestion("what if occupancy rises to 85 percent")).toBe("What if occupancy rises to 85%?");
    expect(normalizeSpokenQuestion("what should I do with 50,000 dollars")).toBe("What should I do with $50,000?");
    expect(normalizeSpokenQuestion("how would you split 250 thousand dollars across the chain")).toBe("How would you split $250,000 across the chain?");
    expect(normalizeSpokenQuestion("what if we set cooling to 76 degrees")).toBe("What if we set cooling to 76°F?");
    expect(normalizeSpokenQuestion("What if occupancy rises to 85%?")).toBe("What if occupancy rises to 85%?");
    expect(normalizeSpokenQuestion("   ")).toBe("");
  });

  it("rewords the answer for the ear without changing its figures", () => {
    const t = textForSpeech("**Cost** goes from $374,741 → $399,140 (+$24,399, +6.5%), 86.5 kBtu/ft²/yr, 23.7 t CO₂e.\nFOLLOW_UPS: What next?");
    expect(t).toContain("$374,741 to $399,140");
    expect(t).toContain("plus $24,399");
    expect(t).toContain("plus 6.5%");
    expect(t).toContain("kBtu per square foot a year");
    expect(t).toContain("tonnes C O 2 equivalent");
    expect(t).not.toMatch(/\*|FOLLOW_UPS|→/);
  });

  it("prefers a clear English voice and explains mic errors", () => {
    const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
    expect(pickVoice([v("Thomas", "fr-FR"), v("Samantha", "en-US"), v("Google US English", "en-US")])!.name).toBe("Google US English");
    expect(pickVoice([v("Thomas", "fr-FR")])).toBeNull();
    expect(micErrorText("not-allowed")).toMatch(/blocked/);
    expect(micErrorText("aborted")).toBeNull();
  });
});

// A fake browser speech engine: recognition we can drive, synthesis we can observe.
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {}
  say(text: string, isFinal: boolean) {
    const res = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [res] });
  }
}

const spoken: string[] = [];
beforeEach(() => {
  window.localStorage.clear();
  useTwin.getState().resetDemo();
  spoken.length = 0;
  (window as unknown as Record<string, unknown>)["SpeechRecognition"] = FakeRecognition;
  (window as unknown as Record<string, unknown>)["SpeechSynthesisUtterance"] = class {
    text: string;
    voice: unknown = null;
    lang = "";
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  (window as unknown as Record<string, unknown>)["speechSynthesis"] = {
    speak: (u: { text: string }) => spoken.push(u.text),
    cancel: vi.fn(),
    getVoices: () => [],
  };
});
afterEach(() => {
  cleanup();
  for (const k of ["SpeechRecognition", "SpeechSynthesisUtterance", "speechSynthesis"]) delete (window as unknown as Record<string, unknown>)[k];
});

describe("voice in the Ask tab", () => {
  it("the mic fills the box while you talk and sends the question when you stop", async () => {
    const ask = vi.spyOn(useTwin.getState(), "askAdvisor").mockResolvedValue(undefined as never);
    useTwin.setState({ askAdvisor: ask as never });
    render(<AdvisorPanel />);
    fireEvent.click(screen.getByTestId("voice-mic"));
    const r = FakeRecognition.last!;
    expect(r.started).toBe(true);
    expect(screen.getByTestId("voice-status").textContent).toBe("Listening…");
    act(() => r.say("what if occupancy rises to 85", false));
    expect((screen.getByLabelText("Ask the advisor") as HTMLTextAreaElement).value).toBe("What if occupancy rises to 85?");
    act(() => r.say("what if occupancy rises to 85 percent", true));
    act(() => r.stop());
    expect(ask).toHaveBeenCalledWith("What if occupancy rises to 85%?");
  });

  it("reads new answers aloud only when the speaker is on, and remembers the choice", () => {
    render(<AdvisorPanel />);
    const add = (text: string) =>
      act(() => useTwin.setState((s) => ({ advisorMessages: [...s.advisorMessages, { id: `m${s.advisorMessages.length}`, role: "advisor", text, source: "fallback" } as never] })));
    add("Off: not read.");
    expect(spoken).toEqual([]);
    fireEvent.click(screen.getByTestId("voice-speak"));
    expect(window.localStorage.getItem(VOICE_STORAGE_KEY)).toBe("on");
    add("The cost goes from $374,741 → $399,140.");
    expect(spoken).toEqual(["The cost goes from $374,741 to $399,140."]);
    expect(screen.getByTestId("voice-stop")).toBeTruthy();
  });

  it("shows a short note when the mic is blocked, and hides voice where the browser has none", () => {
    render(<AdvisorPanel />);
    fireEvent.click(screen.getByTestId("voice-mic"));
    act(() => FakeRecognition.last!.onerror?.({ error: "not-allowed" }));
    act(() => FakeRecognition.last!.onend?.());
    expect(screen.getByTestId("voice-status").textContent).toMatch(/blocked/);
    cleanup();
    for (const k of ["SpeechRecognition", "SpeechSynthesisUtterance", "speechSynthesis"]) delete (window as unknown as Record<string, unknown>)[k];
    render(<AdvisorPanel />);
    expect(screen.queryByTestId("voice-controls")).toBeNull();
    expect(screen.getByLabelText("Ask the advisor")).toBeTruthy();
  });
});
