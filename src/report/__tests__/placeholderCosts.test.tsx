import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { aiReportFromState } from "@/report/fromStore";
import { placeholderCostLabels } from "@/report/data";
import { ResultsSummary } from "@/report/ResultsSummary";
import { compareUpgrades, prepareUpgradeContext } from "@/engine/hotel";

const get = () => useTwin.getState();

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("placeholder installed costs are labeled wherever a package's cost is shown", () => {
  it("names the placeholder-cost upgrades in the plan results and the report limits", async () => {
    vi.useFakeTimers();
    const run = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2100);
    await run;
    vi.useRealTimers();
    const d = aiReportFromState(get())!;
    const labels = placeholderCostLabels(d);
    // The demo's $50,000 plan includes the LED retrofit, whose installed cost is an assumed mix between sourced bounds.
    expect(labels).toContain("LED lighting retrofit");
    expect(d.risks.some((l) => l.includes("LED lighting retrofit") && l.includes("placeholders"))).toBe(true);
    render(<ResultsSummary d={d} />);
    expect(screen.getByTestId("placeholder-costs").textContent).toMatch(/LED lighting retrofit/);
  });

  it("the comparison rows carry the cost status for the hotel's HVAC type", () => {
    const rows = compareUpgrades(prepareUpgradeContext(get().hotel));
    expect(rows.find((r) => r.id === "led_lighting")!.costStatus).toBe("placeholder");
    expect(rows.find((r) => r.id === "smart_room_controls")!.costStatus).toBe("sourced");
  });
});
