import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { HotelMarker } from "@/portfolio/HotelMarker";
import { MapLegend } from "@/portfolio/MapLegend";
import { metricDef } from "@/portfolio/metrics";
import { fitPadding } from "@/portfolio/mapTypes";
import {
  BEARING_3D,
  MAP_MODE_KEY,
  PITCH_3D,
  allInView,
  bearingFor,
  columnHeights,
  columnPolygon,
  columnScale,
  fitPitchedCamera,
  loadMapMode,
  metersPerPixel,
  projectPitched,
  recallAngles,
  rememberAngles,
  saveMapMode,
  unprojectPitched,
} from "@/portfolio/camera3d";
import { FALLBACK_HEIGHT_M, HEIGHT_EXPR, METERS_PER_LEVEL, columnFeatures } from "@/portfolio/buildings3d";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

/** The five demonstration hotels, from the store (not copied numbers). */
const chicago = () => selectPortfolioSummary(useTwin.getState()).properties;

describe("3D camera framing", () => {
  beforeEach(() => useTwin.getState().resetHotel());

  it("projects and unprojects consistently at any tilt and heading", () => {
    const vp = { width: 1000, height: 540, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
    for (const pitch of [0, 30, 55, 70])
      for (const bearing of [0, -25, 90, 200]) {
        const cam = { lng: -87.65, lat: 41.9, zoom: 12, pitch, bearing };
        const center = projectPitched(cam, vp, cam)!;
        expect(center.x).toBeCloseTo(500, 6);
        expect(center.y).toBeCloseTo(270, 6);
        const p = { lng: -87.62, lat: 41.88 };
        const s = projectPitched(cam, vp, p)!;
        const back = unprojectPitched(cam, vp, s.x, s.y);
        expect(back.lng).toBeCloseTo(p.lng, 7);
        expect(back.lat).toBeCloseTo(p.lat, 7);
      }
  });

  it("north is up at bearing 0 and east is up at bearing 90; tilting shrinks what lies behind the center", () => {
    const vp = { width: 800, height: 600, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
    const cam = { lng: 0, lat: 0, zoom: 10, pitch: 0, bearing: 0 };
    expect(projectPitched(cam, vp, { lng: 0, lat: 0.05 })!.y).toBeLessThan(300);
    expect(projectPitched({ ...cam, bearing: 90 }, vp, { lng: 0.05, lat: 0 })!.y).toBeLessThan(300);
    const flat = projectPitched(cam, vp, { lng: 0, lat: 0.05 })!;
    const tilted = projectPitched({ ...cam, pitch: 55 }, vp, { lng: 0, lat: 0.05 })!;
    expect(300 - tilted.y).toBeLessThan(300 - flat.y);
  });

  it("fits every demonstration hotel inside the padded view, tilted, on desktop, tablet and phone sizes", () => {
    const rows = chicago();
    expect(rows).toHaveLength(5);
    for (const [width, height] of [[1078, 540], [800, 480], [366, 400]] as const) {
      const vp = { width, height, padding: fitPadding(width) };
      const cam = fitPitchedCamera(rows, vp, { pitch: PITCH_3D, bearing: bearingFor(rows), maxZoom: 15 });
      expect(cam.pitch).toBe(PITCH_3D);
      expect(cam.bearing).toBe(BEARING_3D);
      expect(allInView(cam, vp, rows)).toBe(true);
      // As large as it can be: a little more zoom would push a hotel out.
      expect(allInView({ ...cam, zoom: cam.zoom + 0.15 }, vp, rows)).toBe(false);
      // Deterministic.
      expect(fitPitchedCamera(rows, vp, { pitch: PITCH_3D, bearing: bearingFor(rows), maxZoom: 15 })).toEqual(cam);
    }
  });

  it("keeps clear of an open hotel card, and a single hotel is capped at the maximum zoom", () => {
    const rows = chicago();
    const vp = { width: 1078, height: 540, padding: fitPadding(1078, true) };
    expect(vp.padding.left).toBeGreaterThanOrEqual(330);
    expect(fitPadding(390, true).left).toBe(30); // phones: the card is below the map
    const cam = fitPitchedCamera(rows, vp, { pitch: PITCH_3D, bearing: BEARING_3D });
    expect(allInView(cam, vp, rows)).toBe(true);
    const one = fitPitchedCamera([rows[0]!], vp, { pitch: PITCH_3D, bearing: 0, maxZoom: 15 });
    expect(one.zoom).toBe(15);
  });

  it("looks north up across several cities and along the skyline heading in one city", () => {
    expect(bearingFor(chicago())).toBe(BEARING_3D);
    expect(bearingFor([{ lng: -73.98, lat: 40.76 }, { lng: -80.19, lat: 25.76 }, { lng: -105, lat: 39.75 }])).toBe(0);
  });
});

describe("data columns", () => {
  it("heights are strictly proportional to the values, from the ground", () => {
    const h = columnHeights({ a: 100, b: 50, c: 0, d: 25 }, 400);
    expect(h).toEqual({ a: 400, b: 200, c: 0, d: 100 });
    expect(columnHeights({ a: 0, b: 0 }, 400)).toEqual({ a: 0, b: 0 });
    expect(columnHeights({ a: -5, b: 10 }, 100)["a"]).toBe(0);
  });

  it("the common scale follows the zoom but never the ratios between hotels", () => {
    const rows = chicago();
    const values = Object.fromEntries(rows.map((r) => [r.id, r.annual.cost]));
    const colors = Object.fromEntries(rows.map((r) => [r.id, "#fff"]));
    const z11 = columnFeatures(rows, values, colors, 11);
    const z13 = columnFeatures(rows, values, colors, 13);
    const max = Math.max(...Object.values(values));
    for (const f of z11.features) {
      const g = z13.features.find((x) => x.properties.id === f.properties.id)!;
      expect(f.properties.height / z11.features.reduce((m, x) => Math.max(m, x.properties.height), 0)).toBeCloseTo(values[f.properties.id]! / max, 9);
      expect(g.properties.height / f.properties.height).toBeCloseTo(1 / 4, 9);
    }
    expect(columnScale(12.2, 41.9).zoom).toBe(12);
    expect(columnScale(12.3, 41.9).zoom).toBe(12.5);
    expect(metersPerPixel(0, 0)).toBeCloseTo(40075016.686 / 512, 3);
  });

  it("a column is a closed square centered on the hotel's true location", () => {
    const ring = columnPolygon(-87.63, 41.88, 50);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    const cx = (ring[0]![0] + ring[2]![0]) / 2;
    const cy = (ring[0]![1] + ring[2]![1]) / 2;
    expect(cx).toBeCloseTo(-87.63, 9);
    expect(cy).toBeCloseTo(41.88, 9);
  });
});

describe("3D buildings", () => {
  it("uses the tiles' heights first, then floors × 3 m, then a documented low default (never invented per building)", () => {
    const expr = JSON.stringify(HEIGHT_EXPR);
    const order = ["render_height", "\"height\"", "building:levels", "\"levels\""].map((k) => expr.indexOf(k));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(METERS_PER_LEVEL).toBe(3);
    expect(FALLBACK_HEIGHT_M).toBeLessThanOrEqual(8);
    expect((HEIGHT_EXPR as unknown[]).at(-1)).toBe(FALLBACK_HEIGHT_M);
  });
});

describe("2D / 3D mode and remembered angles", () => {
  afterEach(() => localStorage.removeItem(MAP_MODE_KEY));
  it("defaults to 3D and remembers the choice", () => {
    localStorage.removeItem(MAP_MODE_KEY);
    expect(loadMapMode()).toBe("3d");
    saveMapMode("2d");
    expect(loadMapMode()).toBe("2d");
    saveMapMode("3d");
    expect(loadMapMode()).toBe("3d");
  });
  it("keeps the tilt and heading for the return trip in memory", () => {
    rememberAngles({ pitch: 48, bearing: -30 });
    expect(recallAngles()).toEqual({ pitch: 48, bearing: -30 });
    rememberAngles(null);
    expect(recallAngles()).toBeNull();
  });
});

describe("markers, legend and the drawn fallback", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    navigate.mockClear();
  });
  afterEach(() => cleanup());

  const markerProps = () => {
    const row = chicago()[0]!;
    return { row, color: "#f00", rank: 1, hovered: false, selected: true, valueText: "x", metricLabel: "Energy cost", onHover: () => {}, onSelect: () => {} };
  };

  it("pulses and shows the beam when motion is allowed; no pulse or ring with reduced effects (the beam stays, still)", () => {
    const p = markerProps();
    const { unmount } = render(<HotelMarker {...p} reduce={false} beam />);
    expect(screen.getByTestId(`marker-pulse-${p.row.id}`)).toBeTruthy();
    expect(screen.getByTestId(`marker-beam-${p.row.id}`).style.animation).toContain("et-marker-beam");
    unmount();
    render(<HotelMarker {...p} reduce beam />);
    expect(screen.queryByTestId(`marker-pulse-${p.row.id}`)).toBeNull();
    expect(screen.getByTestId(`marker-beam-${p.row.id}`).style.animation).toBe("");
    expect(document.querySelector(".animate-ping")).toBeNull();
  });

  it("no beam on the flat map", () => {
    const p = markerProps();
    render(<HotelMarker {...p} reduce={false} />);
    expect(screen.queryByTestId(`marker-beam-${p.row.id}`)).toBeNull();
  });

  it("the legend states the columns' scale only when they are on", () => {
    const def = metricDef("cost");
    const values = chicago().map(def.value);
    const { rerender } = render(<MapLegend def={def} values={values} />);
    expect(screen.queryByTestId("map-legend-columns")).toBeNull();
    rerender(<MapLegend def={def} values={values} columns />);
    expect(screen.getByTestId("map-legend-columns").textContent).toContain(def.format(Math.max(...values)));
  });

  it("without WebGL: the drawn map, no 2D / 3D toggle or columns, and selection still syncs marker, list and card", () => {
    render(<PortfolioPage />);
    expect(screen.getByTestId("map-fallback")).toBeTruthy();
    expect(screen.queryByTestId("map-mode-toggle")).toBeNull();
    expect(screen.queryByTestId("map-columns")).toBeNull();
    const id = chicago()[0]!.id;
    act(() => {
      fireEvent.click(screen.getByTestId(`marker-${id}`));
    });
    expect(screen.getByTestId("property-card")).toBeTruthy();
    expect(document.querySelector(`[data-testid="property-list-item"][data-id="${id}"]`)!.getAttribute("aria-current")).toBe("true");
    expect(screen.getByTestId(`marker-${id}`).getAttribute("aria-pressed")).toBe("true");
    // jsdom has no reduced-motion signal: the map stays calm (no pulse, no card animation).
    expect(screen.queryByTestId(`marker-pulse-${id}`)).toBeNull();
    expect(screen.getByTestId("map-card-slot").className).not.toContain("animate-in");
  });
});
