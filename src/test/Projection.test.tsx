import { describe, expect, it } from "vitest";
import { projectionNote } from "@/components/Projection";
import type { FinancialBreakdown } from "@/engine/hotel/types";

describe("Projection note", () => {
  it("mentions solar degradation only for a solar financial breakdown", () => {
    expect(projectionNote({ solar: null } as FinancialBreakdown)).not.toMatch(/solar output/);
    expect(projectionNote({ solar: {} } as FinancialBreakdown)).toMatch(/solar output/);
  });
});
