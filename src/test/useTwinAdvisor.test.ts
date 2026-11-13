import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advisor } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { clearSavedAdvisorAnswers } from "@/store/advisorAnswers";

const get = () => useTwin.getState();
const ENDPOINT = "https://example.test/functions/v1/advisor";

function useFetch(handler: (body: { question: string; context: advisor.AdvisorContext }) => Promise<Response> | Response) {
  const fetchFn = vi.fn(async (_url: string, init: RequestInit) => handler(JSON.parse(init.body as string)));
  advisor.setAdvisorConfig({ endpoint: ENDPOINT, headers: {}, fetchFn: fetchFn as unknown as typeof fetch });
  return fetchFn;
}
const ok = (text: string) => new Response(JSON.stringify({ text }), { status: 200 });

beforeEach(() => {
  get().resetHotel();
  get().clearAdvisor();
  advisor.clearAdvisorCache();
  clearSavedAdvisorAnswers();
  advisor.setAdvisorConfig(null);
});
afterEach(() => {
  advisor.setAdvisorConfig(null);
  vi.useRealTimers();
});

describe("advisor in the store", () => {
  it("answers with the template when no advisor function is set up, and keeps the conversation", async () => {
    advisor.setAdvisorConfig({ endpoint: null, headers: {} });
    await get().askAdvisor("Why is HVAC my biggest cost?");
    const [q, a] = get().advisorMessages;
    expect(q).toMatchObject({ id: "m-1", role: "user", text: "Why is HVAC my biggest cost?" });
    expect(a).toMatchObject({ id: "m-2", role: "advisor", source: "fallback", reason: "not_configured" });
    expect(a!.text).toMatch(/HVAC is your largest cost category/);
    expect(get().advisorBusy).toBe(false);
    await get().askAdvisor("How does occupancy change my energy use?");
    expect(get().advisorMessages.map((m) => m.id)).toEqual(["m-1", "m-2", "m-3", "m-4"]);
  });

  it("sends the question and the engine's context, and shows a model answer that passes the number check", async () => {
    const baselineCost = Math.round(get().baseline.annual.cost);
    const fetchFn = useFetch((body) => ok(`Your estimated bill is about $${body.context.baseline.annualCost.toLocaleString("en-US")} a year.`));
    await get().askAdvisor("What is my bill?");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string) as { question: string; context: advisor.AdvisorContext };
    expect(sent.question).toBe("What is my bill?");
    expect(sent.context.baseline.annualCost).toBe(baselineCost);
    const a = get().advisorMessages[1]!;
    expect(a.source).toBe("ai");
    expect(a.reason).toBeUndefined();
    expect(a.text).toContain(baselineCost.toLocaleString("en-US"));
  });

  it("replaces a model answer with an invented number by the template answer", async () => {
    useFetch(() => ok("Your bill is $1,234,567 a year."));
    await get().askAdvisor("What is my bill?");
    const a = get().advisorMessages[1]!;
    expect(a).toMatchObject({ source: "fallback", reason: "rejected" });
    expect(a.text).not.toContain("1,234,567");
  });

  it("includes the current plan and scenario in the context", async () => {
    get().applyStressTest("price_up_20"); // turns on optimizing for the scenario
    vi.useFakeTimers();
    const run = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await run;
    vi.useRealTimers();
    let seen: advisor.AdvisorContext | null = null;
    useFetch((body) => {
      seen = body.context;
      return ok("OK.");
    });
    await get().askAdvisor("Should I start with solar or smart thermostats?");
    expect(seen!.plan!.packages).toHaveLength(3);
    expect(seen!.scenario!.annualCostChange).toBeGreaterThan(0);
    expect(seen!.upgradesMeasuredAgainst).toBe("scenario");
    expect(seen!.hotel.syntheticDemo).toBe(true);
  });

  it("builds a plan for a budget named in the question", async () => {
    let seen: advisor.AdvisorContext | null = null;
    useFetch((body) => {
      seen = body.context;
      return ok("OK.");
    });
    await get().askAdvisor("How should I use $30,000?");
    expect(seen!.otherBudgets.map((p) => p.budget)).toEqual([30000]);
  });

  it("ignores empty questions and a second question while one is running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchFn = useFetch(async () => {
      await gate;
      return ok("Fine.");
    });
    await get().askAdvisor("   ");
    expect(get().advisorMessages).toEqual([]);
    const first = get().askAdvisor("What is my bill?");
    expect(get().advisorBusy).toBe(true);
    await get().askAdvisor("Another question");
    expect(get().advisorMessages).toHaveLength(1);
    release();
    await first;
    expect(get().advisorBusy).toBe(false);
    expect(get().advisorMessages).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("clearAdvisor and resetHotel empty the conversation", async () => {
    advisor.setAdvisorConfig({ endpoint: null, headers: {} });
    await get().askAdvisor("What is my bill?");
    expect(get().advisorMessages).toHaveLength(2);
    get().clearAdvisor();
    expect(get().advisorMessages).toEqual([]);
    await get().askAdvisor("What is my bill?");
    get().resetHotel();
    expect(get().advisorMessages).toEqual([]);
    expect(get().advisorBusy).toBe(false);
  });

  it("exports the suggested questions for the chat panel", () => {
    expect(advisor.ADVISOR_SUGGESTED_QUESTIONS).toContain("How should I use $30,000?");
  });
});
