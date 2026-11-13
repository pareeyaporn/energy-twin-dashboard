import { beforeEach, describe, expect, it } from "vitest";
import { hotelOrganizations, prepareProperty } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectActiveProperty, selectIsSynthetic, selectPortfolioItems, selectPortfolioSummary } from "@/store/hotelDerived";

const get = () => useTwin.getState();
beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("organizations data", () => {
  it("has three synthetic organizations whose hotels all carry a brand, region and ownership type", () => {
    expect(hotelOrganizations.map((o) => o.id)).toEqual(["lakefront-hotel-group", "northshore-hospitality", "meridian-hotels"]);
    const ids = new Set<string>();
    for (const o of hotelOrganizations) {
      expect(o.synthetic).toBe(true);
      for (const p of o.properties) {
        expect(ids.has(p.id)).toBe(false);
        ids.add(p.id);
        expect(p.organizationId).toBe(o.id);
        expect(p.brand && p.region && p.ownership).toBeTruthy();
        expect(prepareProperty(p).baseline.annual.cost).toBeGreaterThan(0);
      }
    }
    expect(hotelOrganizations[1]!.properties).toHaveLength(4);
  });
});

describe("organization switcher and filters", () => {
  it("switches organization: every portfolio view follows; the demo chain is the default", () => {
    expect(get().organizationId).toBe("lakefront-hotel-group");
    expect(selectPortfolioSummary(get()).totals.properties).toBe(5);
    get().setOrganization("northshore-hospitality");
    expect(get().portfolio.name).toBe("Northshore Hospitality");
    const s = selectPortfolioSummary(get());
    expect(s.totals.properties).toBe(4);
    expect(s.properties.map((r) => r.brand)).toContain("Northshore Suites");
    expect(get().portfolioStressScope).toHaveLength(4);
  });

  it("filters by brand, region and ownership; totals and the optimizer follow", async () => {
    get().setPortfolioFilter({ brand: "Lakefront Grand" });
    expect(selectPortfolioItems(get()).map((x) => x.property.id)).toEqual(["riverwalk-grand", "lakefront-convention"]);
    expect(selectPortfolioSummary(get()).totals.rooms).toBe(780);
    get().setPortfolioFilter({ brand: null, region: "Airports" });
    expect(selectPortfolioItems(get()).map((x) => x.property.id)).toEqual(["ohare-gateway"]);
    get().setPortfolioFilter({ region: null, ownership: "managed" });
    expect(selectPortfolioItems(get()).map((x) => x.property.id)).toEqual(["lakefront-convention", "wells-street"]);
    get().setPortfolioFilter({ ownership: null });
    expect(selectPortfolioItems(get())).toHaveLength(5);
  });

  it("a hotel from another organization stays open and labeled after switching", () => {
    get().openProperty("hyde-park-inn");
    get().setOrganization("northshore-hospitality");
    get().openProperty("hyde-park-inn");
    expect(get().hotel.profile.name).toBe("Hyde Park Inn");
    get().setOrganization("lakefront-hotel-group");
    expect(selectActiveProperty(get())?.id).toBe("hyde-park-inn");
    expect(selectIsSynthetic(get())).toBe(true);
  });

  it("Add my hotel puts the hotel in the selected organization with its brand and ownership", () => {
    get().setOrganization("northshore-hospitality");
    const id = get().addUserHotel({ name: "Maple Suites", rooms: 120 }, "lincoln-park", { brand: "Maple", ownership: "leased" });
    const p = get().portfolio.properties.find((x) => x.id === id)!;
    expect(p).toMatchObject({ organizationId: "northshore-hospitality", brand: "Maple", ownership: "leased", region: "North Side" });
    get().setOrganization("lakefront-hotel-group");
    expect(get().portfolio.properties.some((x) => x.id === id)).toBe(false);
  });
});
