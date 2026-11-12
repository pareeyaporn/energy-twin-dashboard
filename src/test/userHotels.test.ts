import { beforeEach, describe, expect, it } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectHotelLabel, selectIsSynthetic, selectPortfolioSummary } from "@/store/hotelDerived";
import { USER_HOTELS_STORAGE_KEY, readUserHotels, sanitizeUserHotels } from "@/store/userHotels";
import { draftToInput } from "@/portfolio/AddHotelDialog";

const get = () => useTwin.getState();

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("Add my hotel", () => {
  it("adds the hotel to the portfolio, saved in this browser, labeled as the user's own (not synthetic)", () => {
    const id = get().addUserHotel({ name: "Maple Suites", rooms: 150, hvacType: "ptac", occupancy: 0.7 }, "west-loop");
    expect(get().portfolio.properties).toHaveLength(6);
    const p = get().portfolio.properties.find((x) => x.id === id)!;
    expect(p.synthetic).toBe(false);
    expect(p.neighborhood).toBe("West Loop");
    expect(readUserHotels().hotels.map((h) => h.input.name)).toEqual(["Maple Suites"]);
    const row = selectPortfolioSummary(get()).properties.find((x) => x.id === id)!;
    expect(row.rooms).toBe(150);
    expect(row.annual.cost).toBeGreaterThan(0);
    expect(get().portfolioStressScope).toContain(id);
    get().openProperty(id);
    expect(get().hotel.profile.name).toBe("Maple Suites");
    expect(selectIsSynthetic(get())).toBe(false);
    expect(selectHotelLabel(get()).synthetic).toBe(false);
  });

  it("keeps edits to the user's hotel and restores it after a reload", () => {
    const id = get().addUserHotel({ name: "Maple Suites", rooms: 150 }, "loop");
    get().openProperty(id);
    get().setHotelInput({ rooms: 180 });
    expect(readUserHotels().hotels[0]!.input.rooms).toBe(180);
    // A reload: the store starts empty, then reads the browser's storage.
    useTwin.setState({ userHotels: [], userHotelsHydrated: false, portfolio: get().portfolio.properties.length ? { ...get().portfolio, properties: get().portfolio.properties.slice(0, 5) } : get().portfolio });
    get().hydrateUserHotels();
    expect(get().portfolio.properties.find((x) => x.id === id)?.input.rooms).toBe(180);
  });

  it("removes a hotel (and leaves it if it was open)", () => {
    const id = get().addUserHotel({ rooms: 90 }, "loop");
    get().openProperty(id);
    get().removeUserHotel(id);
    expect(get().portfolio.properties).toHaveLength(5);
    expect(get().activePropertyId).toBeNull();
    expect(get().hotelPresetId).toBe("demo-chicago-100");
    expect(window.localStorage.getItem(USER_HOTELS_STORAGE_KEY)).toContain('"hotels":[]');
  });

  it("Reset demo removes added hotels; sample hotels stay synthetic", () => {
    get().addUserHotel({ rooms: 90 }, "loop");
    get().resetDemo();
    expect(get().portfolio.properties).toHaveLength(5);
    get().openProperty("ohare-gateway");
    expect(selectIsSynthetic(get())).toBe(true);
  });

  it("ignores invalid stored data", () => {
    expect(sanitizeUserHotels({ version: 1, hotels: [{ id: "x", input: { rooms: 10 } }, { id: "my-hotel-2", input: { rooms: -1 } }, { id: "my-hotel-3", areaId: "nowhere", input: { rooms: 40, hvacType: "steam" } }] }).hotels.map((h) => [h.id, h.neighborhood, h.input.hvacType])).toEqual([["my-hotel-3", "The Loop", undefined]]);
  });

  it("checks the form: rooms required, ranges enforced, blanks use defaults", () => {
    const base = { name: "", area: "loop" as const, rooms: "", floors: "", floorArea: "", yearBuilt: "", hvac: "vrf" as const, occupancy: "", bill: "", budget: "" };
    expect(draftToInput(base).errors[0]).toMatch(/Guest rooms/);
    expect(draftToInput({ ...base, rooms: "120", occupancy: "150" }).errors[0]).toMatch(/Occupancy/);
    expect(draftToInput({ ...base, rooms: "120", occupancy: "72", bill: "$9,500" }).input).toEqual({ rooms: 120, hvacType: "vrf", occupancy: 0.72, monthlyEnergyBill: 9500 });
  });
});
