import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { PortfolioBreadcrumb } from "@/twin/parts/PortfolioBreadcrumb";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

describe("Portfolio page", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    navigate.mockClear();
  });
  afterEach(() => cleanup());

  it("renders the chain, its totals, the drawn map (no WebGL in tests) and the synthetic label", () => {
    render(<PortfolioPage />);
    expect(screen.getByRole("heading", { name: /Lakefront Hotel Group/ })).toBeTruthy();
    expect(screen.getByTestId("portfolio-synthetic").textContent).toMatch(/Synthetic/);
    expect(screen.getByTestId("map-fallback")).toBeTruthy();
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(5);
    expect(screen.getByLabelText("Portfolio totals").textContent).toContain("1,172");
  });

  it("sorts the comparison table", () => {
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("sort-rooms"));
    const first = () => within(screen.getAllByTestId("portfolio-row")[0]!).getAllByRole("cell")[0]!.textContent;
    expect(first()).toBe("Lakefront Convention Hotel");
    fireEvent.click(screen.getByTestId("sort-rooms"));
    expect(first()).toBe("Wells Street Hotel");
  });

  it("hovering a marker shows its card, and Explore digital twin opens that hotel", () => {
    render(<PortfolioPage />);
    fireEvent.mouseEnter(screen.getByTestId("marker-ohare-gateway"));
    const card = screen.getByTestId("property-card");
    expect(card.textContent).toContain("O'Hare Gateway Hotel");
    expect(card.textContent).toContain("Demonstration property");
    fireEvent.click(screen.getByTestId("explore-ohare-gateway"));
    expect(useTwin.getState().activePropertyId).toBe("ohare-gateway");
    expect(useTwin.getState().hotel.profile.name).toBe("O'Hare Gateway Hotel");
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("runs the portfolio optimizer and lists a package per hotel", async () => {
    vi.useFakeTimers();
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("run-portfolio"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(screen.getByTestId("portfolio-plan")).toBeTruthy();
    expect(screen.getAllByTestId("allocation-row")).toHaveLength(5);
    vi.useRealTimers();
  });

  it("shows the breadcrumb in the twin only for a portfolio hotel", () => {
    const { container, rerender } = render(<PortfolioBreadcrumb />);
    expect(container.textContent).toBe("");
    act(() => useTwin.getState().openProperty("wells-street"));
    rerender(<PortfolioBreadcrumb />);
    expect(screen.getByTestId("portfolio-breadcrumb").textContent).toContain("Wells Street Hotel");
  });
});
