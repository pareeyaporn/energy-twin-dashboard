import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { STRESS_TESTS, ZONE_IDS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { HotelTwin } from "../HotelTwin";
import { usd } from "../format";

beforeAll(() => {
  // Recharts measures its container with ResizeObserver, which jsdom does not have.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const get = () => useTwin.getState();
const zoneButton = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  get().resetHotel();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HotelTwin header and zones", () => {
  it("labels both guest-room wings, writes the hallway label level, and spreads the color scale", () => {
    const { container } = render(<HotelTwin />);
    const guest = zoneButton(/Guest rooms:/);
    expect(within(guest).getByText(`${get().hotel.profile.rooms} rooms`)).toBeInTheDocument();
    expect(within(guest).getByText(`${get().hotel.profile.floors} floors`)).toBeInTheDocument();
    const halls = zoneButton(/Hallways and shared facilities:/);
    for (const t of halls.querySelectorAll("text")) expect(t.getAttribute("transform")).toBeNull();
    // The cheapest zone is drawn fully blue and the most expensive fully red.
    const fills = [...container.querySelectorAll("svg rect[fill^='color-mix']")].map((r) => r.getAttribute("fill"));
    expect(fills).toContain("color-mix(in oklab, var(--efficient), var(--heat) 0%)");
    expect(fills).toContain("color-mix(in oklab, var(--heat), var(--loss) 100%)");
  });


  it("shows the hotel, a simulated-data label and the baseline cost", () => {
    render(<HotelTwin />);
    expect(screen.getByText("Lakeshore Inn")).toBeInTheDocument();
    expect(screen.getByTestId("simulated-badge")).toHaveTextContent(/Synthetic demo data/);
    expect(screen.getByTestId("twin-cost")).toHaveTextContent(usd(get().baseline.annual.cost));
    expect(screen.getByTestId("twin-kind")).toHaveTextContent("Current");
    expect(screen.queryByTestId("twin-delta")).toBeNull();
  });

  it("has a button for each of the six zones, labeled with its yearly cost and share", () => {
    render(<HotelTwin />);
    for (const name of [/Guest rooms:/, /Lobby and common areas:/, /Kitchen and restaurant:/, /Hallways and shared facilities:/, /Central HVAC and mechanical:/, /Hot water:/]) {
      expect(zoneButton(name)).toHaveAccessibleName(/\$[\d,]+ a year, \d+% of the total/);
    }
    expect(ZONE_IDS).toHaveLength(6);
  });

  it("selecting a zone opens its details; selecting it again closes them", () => {
    render(<HotelTwin />);
    expect(screen.getByText(/Select a zone on the diagram/)).toBeInTheDocument();
    fireEvent.click(zoneButton(/Hot water:/));
    expect(get().selectedZone).toBe("hot_water");
    const panel = screen.getByRole("complementary", { name: "Zone details" });
    expect(within(panel).getByRole("heading", { name: "Hot water" })).toBeInTheDocument();
    expect(within(panel).getByText(/Cost per year \(estimate\)/)).toBeInTheDocument();
    expect(within(panel).getByText(/Operating schedule:/)).toBeInTheDocument();
    expect(within(panel).getByText(/Efficiency assumptions:/)).toBeInTheDocument();
    expect(within(panel).getByText(/High-efficiency water heating and low-flow fixtures/)).toBeInTheDocument();
    fireEvent.click(zoneButton(/Hot water:/));
    expect(get().selectedZone).toBeNull();
  });

  it("can be used from the keyboard and closed with the Close button", () => {
    render(<HotelTwin />);
    fireEvent.keyDown(zoneButton(/Guest rooms:/), { key: "Enter" });
    expect(get().selectedZone).toBe("guest_rooms");
    fireEvent.click(screen.getByRole("button", { name: "Close zone details" }));
    expect(get().selectedZone).toBeNull();
    fireEvent.keyDown(zoneButton(/Lobby and common areas:/), { key: " " });
    expect(get().selectedZone).toBe("lobby_common");
    fireEvent.keyDown(zoneButton(/Lobby and common areas:/), { key: "a" });
    expect(get().selectedZone).toBe("lobby_common");
  });

  it("marks the selected zone as pressed", () => {
    render(<HotelTwin />);
    fireEvent.click(zoneButton(/Central HVAC and mechanical:/));
    expect(zoneButton(/Central HVAC and mechanical:/)).toHaveAttribute("aria-pressed", "true");
    expect(zoneButton(/Hot water:/)).toHaveAttribute("aria-pressed", "false");
  });
});

describe("HotelTwin layers", () => {
  it("switches between zones, rooms, equipment and flow", () => {
    render(<HotelTwin />);
    const tab = (name: string) => screen.getByRole("tab", { name });
    expect(tab("Zones")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(tab("Rooms"));
    expect(get().twinLayer).toBe("rooms");
    expect(screen.getByTestId("room-summary")).toHaveTextContent(/of 100 rooms booked/);
    expect(screen.queryByRole("group", { name: /Hotel cross-section/ })).toBeNull();

    fireEvent.click(tab("Equipment"));
    expect(screen.getAllByText("estimate").length).toBeGreaterThan(5);
    expect(screen.getAllByText(/Schedule:/).length).toBeGreaterThan(5);

    fireEvent.click(tab("Flow"));
    const table = screen.getByRole("table", { name: "Energy cost flows" });
    expect(within(table).getAllByText("Grid electricity").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Natural gas").length).toBeGreaterThan(0);

    fireEvent.click(tab("Zones"));
    expect(screen.getByRole("group", { name: /Hotel cross-section/ })).toBeInTheDocument();
  });

  it("the equipment layer focuses on the selected zone", () => {
    render(<HotelTwin />);
    fireEvent.click(zoneButton(/Hot water:/));
    fireEvent.click(screen.getByRole("tab", { name: "Equipment" }));
    expect(screen.getByText(/Water heaters/)).toBeInTheDocument();
    expect(screen.queryByText(/Elevators/)).toBeNull();
  });

  it("the room map follows the smart-controls scenario", () => {
    render(<HotelTwin />);
    fireEvent.click(screen.getByRole("tab", { name: "Rooms" }));
    expect(screen.getByTestId("room-summary")).not.toHaveTextContent(/set back/);
    act(() => get().setScenario({ smartRoomControls: true }));
    expect(screen.getByTestId("room-summary")).toHaveTextContent(/set back by smart controls/);
  });
});

describe("HotelTwin time controls", () => {
  it("the hour slider and month select drive the store and the clock label", () => {
    render(<HotelTwin />);
    fireEvent.change(screen.getByLabelText("Hour of day"), { target: { value: "15" } });
    expect(get().timeHour).toBe(15);
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "0" } });
    expect(get().timeMonth).toBe(0);
    expect(screen.getByTestId("clock-label")).toHaveTextContent("Jan · 3:00 PM");
  });

  it("year mode scrubs months", () => {
    render(<HotelTwin />);
    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(get().timeMode).toBe("year");
    expect(screen.getByLabelText("Month of year")).toHaveAttribute("max", "11");
    fireEvent.change(screen.getByLabelText("Month of year"), { target: { value: "7" } });
    expect(get().timeMonth).toBe(7);
    expect(screen.getByTestId("clock-label")).toHaveTextContent("Aug");
    expect(screen.getByTestId("meter")).toHaveTextContent(/in Aug/);
  });

  it("plays and pauses, advancing the hour, and wraps at midnight", () => {
    vi.useFakeTimers();
    render(<HotelTwin />);
    act(() => get().setTime({ hour: 22 }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(get().playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(get().timeHour).toBe(23);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(get().timeHour).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(get().timeHour).toBe(0);
  });

  it("plays faster at higher speed and walks the months in year mode", () => {
    vi.useFakeTimers();
    render(<HotelTwin />);
    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    act(() => get().setTime({ month: 11 }));
    fireEvent.click(screen.getByRole("button", { name: "4x" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(get().timeMonth).toBe(3); // four steps in 900 ms at 4x: Dec -> Jan, Feb, Mar, Apr is index 3
  });

  it("stops the clock when the component unmounts", () => {
    vi.useFakeTimers();
    const { unmount } = render(<HotelTwin />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    unmount();
    const hour = get().timeHour;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(get().timeHour).toBe(hour);
  });

  it("always labels the meter as simulated", () => {
    render(<HotelTwin />);
    expect(screen.getByTestId("meter")).toHaveTextContent(/Simulated meter/);
    expect(screen.getByTestId("meter")).toHaveTextContent(/Modeled values, not measurements/);
    expect(screen.getByTestId("meter")).toHaveTextContent(/kW/);
  });
});

describe("HotelTwin stress tests and comparison", () => {
  it("lists the four stress tests and toggles one", () => {
    render(<HotelTwin />);
    for (const t of STRESS_TESTS) expect(screen.getByRole("button", { name: t.label })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Heat wave" }));
    expect(get().activeStressTest).toBe("heat_wave");
    expect(screen.getByTestId("stress-description")).toHaveTextContent(/July runs 10 F hotter/);
    expect(screen.getByTestId("stress-description")).toHaveTextContent(/Estimated change: \+\$[\d,]+ per year/);
    expect(screen.getByTestId("twin-kind")).toHaveTextContent("What-if");
    expect(screen.getByTestId("twin-delta")).toHaveTextContent(/per year vs before/);
    fireEvent.click(screen.getByRole("button", { name: "Heat wave" }));
    expect(get().activeStressTest).toBeNull();
    expect(screen.queryByTestId("stress-description")).toBeNull();
  });

  it("the diagram reacts: zone costs change with the scenario and the header cost follows", () => {
    render(<HotelTwin />);
    const before = zoneButton(/Central HVAC and mechanical:/).getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: "Heat wave" }));
    const after = zoneButton(/Central HVAC and mechanical:/).getAttribute("aria-label");
    expect(after).not.toBe(before);
    expect(screen.getByTestId("twin-cost")).toHaveTextContent(usd(get().scenarioResult!.after.annual.cost));
  });

  it("before shows the baseline, after shows the scenario, and split shows both", () => {
    render(<HotelTwin />);
    fireEvent.click(screen.getByRole("button", { name: "Electricity +20%" }));
    const group = () => screen.getByRole("group", { name: /Hotel cross-section/ });
    const zoneCost = (r: typeof get extends () => infer S ? S : never, which: "before" | "after") =>
      usd(which === "before" ? r.baseline.byZone.hot_water.cost : r.scenarioResult!.after.byZone.hot_water.cost);

    fireEvent.click(screen.getByRole("button", { name: "Before" }));
    expect(within(group()).getByRole("button", { name: /Hot water:/ })).toHaveAccessibleName(new RegExp(zoneCost(get(), "before").replace("$", "\\$")));
    fireEvent.click(screen.getByRole("button", { name: "After" }));
    expect(within(group()).getByRole("button", { name: /Hot water:/ })).toHaveAccessibleName(new RegExp(zoneCost(get(), "after").replace("$", "\\$")));
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(get().compareMode).toBe("split");
    expect(within(group()).getByText("Before")).toBeInTheDocument();
    expect(within(group()).getByText("After")).toBeInTheDocument();
    expect(within(group()).getAllByText(/^was \$/).length).toBeGreaterThan(0);
  });
});

describe("HotelTwin with an applied package", () => {
  async function applyFirstPackage() {
    vi.useFakeTimers();
    const p = get().runHotelOptimizer();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await p;
    act(() => get().applyHotelPackage(get().hotelPlan!.packages[0]!.evaluation.id));
    vi.useRealTimers();
  }

  it("draws the installed upgrades on the building and shows the saving", async () => {
    render(<HotelTwin />);
    await applyFirstPackage();
    const pkg = get().hotelPlan!.packages[0]!;
    const overlay = screen.getByTestId("ghost-upgrades");
    for (const id of pkg.evaluation.upgradeIds) expect(overlay.querySelector(`[data-upgrade="${id}"]`)).not.toBeNull();
    // and nothing that is not installed
    const drawn = [...overlay.querySelectorAll("[data-upgrade]")].map((n) => n.getAttribute("data-upgrade"));
    expect(drawn.sort()).toEqual([...pkg.evaluation.upgradeIds].sort());
    expect(screen.getByTestId("installed-upgrades")).toBeInTheDocument();
    expect(screen.getByTestId("twin-kind")).toHaveTextContent(/With upgrades/);
    expect(screen.getByTestId("twin-delta")).toHaveTextContent(/-\$[\d,]+ per year vs before/);
    expect(screen.getByTestId("twin-cost")).toHaveTextContent(usd(pkg.evaluation.newAnnualCost));
  });

  it("removes the upgrades when the package is cleared", async () => {
    render(<HotelTwin />);
    await applyFirstPackage();
    act(() => get().applyHotelPackage(null));
    expect(screen.getByTestId("ghost-upgrades").querySelectorAll("[data-upgrade]")).toHaveLength(0);
    expect(screen.queryByTestId("installed-upgrades")).toBeNull();
  });
});

describe("HotelTwin accessibility and effects", () => {
  it("reports reduced effects on the root and removes pulsing", () => {
    render(<HotelTwin />);
    expect(screen.getByRole("region", { name: "Hotel digital twin" })).toHaveAttribute("data-reduce-effects", "false");
    act(() => get().setReduceEffects(true));
    expect(screen.getByRole("region", { name: "Hotel digital twin" })).toHaveAttribute("data-reduce-effects", "true");
  });

  it("uses real tabs, pressed buttons and labeled controls", () => {
    render(<HotelTwin />);
    expect(screen.getByRole("tablist", { name: "Twin layer" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Compare" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Playback speed" })).toBeInTheDocument();
    expect(screen.getByLabelText("Hour of day")).toBeInTheDocument();
  });
});
