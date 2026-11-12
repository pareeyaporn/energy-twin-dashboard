import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { benchmarkComparison } from "@/engine/hotel";
import { BenchmarkCard } from "@/components/BenchmarkCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTwin } from "@/store/useTwin";

describe("Peer benchmark card", () => {
  beforeEach(() => useTwin.getState().resetHotel());
  afterEach(cleanup);

  it("shows the baseline EUI and every supplied peer difference", () => {
    const state = useTwin.getState();
    const expected = benchmarkComparison(state.baseline, state.hotel.profile.floorAreaSqft);
    render(<TooltipProvider><BenchmarkCard /></TooltipProvider>);

    expect(screen.getByTestId("hotel-site-eui")).toHaveAttribute("data-value", String(expected.siteEuiKBtuPerSqft));
    for (const peer of expected.peers) {
      const row = screen.getByTestId(`benchmark-peer-${peer.id}`);
      expect(row).toHaveAttribute("data-value", String(peer.siteEuiKBtuPerSqft));
      expect(row).toHaveAttribute("data-difference", String(peer.difference));
    }
  });

  it("recomputes the modeled EUI when floor area changes", () => {
    render(<TooltipProvider><BenchmarkCard /></TooltipProvider>);
    act(() => useTwin.getState().setHotelInput({ floorAreaSqft: 100000 }));
    const state = useTwin.getState();
    const expected = benchmarkComparison(state.baseline, state.hotel.profile.floorAreaSqft);
    expect(screen.getByTestId("hotel-site-eui")).toHaveAttribute("data-value", String(expected.siteEuiKBtuPerSqft));
  });
});
