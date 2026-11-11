import { describe, it, expect, beforeEach } from "vitest";
import { useTwin, selectCurrentCost } from "@/store/useTwin";

describe("Energy Twin store", () => {
  beforeEach(() => useTwin.getState().selectPreset("maya"));
  it("starts with Maya's house at $2,340/yr and a $15,000 budget", () => {
    expect(selectCurrentCost(useTwin.getState())).toBe(2340);
    expect(useTwin.getState().budget).toBe(15000);
  });
  it("selecting package 1 drops the yearly cost to $1,410", async () => {
    await useTwin.getState().runOptimize();
    useTwin.getState().setActivePackage("p1");
    expect(selectCurrentCost(useTwin.getState())).toBe(1410);
  }, 5000);
});
