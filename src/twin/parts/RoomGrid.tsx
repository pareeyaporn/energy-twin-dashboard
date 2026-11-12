import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { END_USES, typicalDayByZoneEndUse } from "@/engine/hotel";
import type { RoomPoint } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectHourState, selectRooms } from "@/store/hotelDerived";
import { lightingFor, seasonOf } from "@/three/environment";
import { hourLabel, monthLabel } from "../format";
import { facadeLayout, windowColor } from "./roomFacade";

const STATE_TEXT = { occupied: "guest in room", away: "booked, guest out", vacant: "vacant" } as const;

/**
 * The hotel's guest rooms as a façade, floor by floor, using the engine's room pattern for the clock's month and hour: lit windows are
 * guests in their rooms, dim windows booked rooms with the guest out, dark windows vacant rooms; a blue sill marks rooms that smart
 * controls have set back. Windows read as glass by day and glow at night (same sun as the 3D view). Click a room to inspect it.
 */
export function RoomGrid() {
  const rooms = useTwin(selectRooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);
  const reduce = useTwin((s) => s.reduceEffects);
  const hourState = useTwin(selectHourState);
  const displayed = useTwin(selectDisplayed);
  const [picked, setPicked] = useState<number | null>(null);

  const counts = { occupied: 0, away: 0, vacant: 0, setback: 0 };
  for (const r of rooms) {
    counts[r.state] += 1;
    if (r.setback) counts.setback += 1;
  }
  const booked = counts.occupied + counts.away;
  const light = lightingFor(hourState.sunElevationDeg, seasonOf(month));
  const layout = useMemo(() => facadeLayout(rooms, floors), [rooms, floors]);
  const day = useMemo(() => typicalDayByZoneEndUse(displayed.result, month), [displayed.result, month]);
  const room = picked !== null ? rooms[picked] : undefined;

  const move = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = picked ?? 0;
    const per = layout.perFloor;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: per, ArrowDown: -per }[e.key];
    if (delta === undefined) {
      if (e.key === "Escape") setPicked(null);
      return;
    }
    e.preventDefault();
    const next = Math.min(rooms.length - 1, Math.max(0, cur + delta));
    setPicked(next);
  };

  return (
    <div>
      <p className="mb-3 text-sm" data-testid="room-summary">
        <span className="font-semibold">{booked}</span> of {rooms.length} rooms booked, <span className="font-semibold">{counts.occupied}</span> with a guest in the room,{" "}
        <span className="font-semibold">{counts.vacant}</span> vacant
        {counts.setback > 0 && (
          <>
            , <span className="font-semibold">{counts.setback}</span> set back by smart controls
          </>
        )}
        . <span className="text-muted-foreground">{monthLabel(month)}, {hourLabel(hour)} (modeled)</span>
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-auto max-h-[520px] w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
          role="group"
          aria-label={`Room map: ${booked} of ${rooms.length} booked, ${counts.occupied} with a guest present, ${counts.setback} set back. Use the arrow keys to move between rooms.`}
          tabIndex={0}
          onKeyDown={move}
          onFocus={() => picked === null && setPicked(0)}
          data-testid="room-facade"
        >
          <rect x={0} y={0} width={layout.width} height={layout.height} fill={light.sky} style={{ transition: reduce ? undefined : "fill 600ms ease" }} />
          {/* Building */}
          <rect x={layout.bx} y={layout.by - 6} width={layout.bw} height={6} rx={1} fill="#cfc9bf" />
          <rect x={layout.bx} y={layout.by} width={layout.bw} height={layout.bh} fill={light.daylight > 0.5 ? "#d9cfbf" : "#5c5852"} style={{ transition: reduce ? undefined : "fill 600ms ease" }} />
          {layout.floorLines.map((y) => (
            <rect key={y} x={layout.bx} y={y} width={layout.bw} height={1.5} fill="#00000022" />
          ))}
          {layout.floorLabels.map((f) => (
            <text key={f.floor} x={layout.bx - 6} y={f.y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--muted-foreground)">
              {f.floor}
            </text>
          ))}
          {/* Lobby level */}
          <rect x={layout.bx} y={layout.lobbyY} width={layout.bw} height={layout.lobbyH} fill="#39414d" />
          <rect x={layout.bx + layout.bw * 0.06} y={layout.lobbyY + layout.lobbyH * 0.25} width={layout.bw * 0.88} height={layout.lobbyH * 0.6} fill={light.daylight > 0.5 ? "#9fb4d9" : "#ffd99a"} opacity={0.85} />
          <text x={layout.bx + layout.bw / 2} y={layout.lobbyY + layout.lobbyH * 0.58} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#1b2230">
            Lobby · restaurant
          </text>
          <rect x={0} y={layout.lobbyY + layout.lobbyH} width={layout.width} height={layout.height - layout.lobbyY - layout.lobbyH} fill="var(--muted)" opacity={0.4} />
          {layout.windows.map((w) => {
            const r = rooms[w.index];
            if (!r) return null;
            const sel = picked === w.index;
            return (
              <g key={w.index} onClick={() => setPicked(sel ? null : w.index)} className="cursor-pointer">
                <title>{`Room ${r.number}: ${STATE_TEXT[r.state]}${r.setback ? ", set back" : ""}`}</title>
                <rect
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={w.h}
                  rx={1}
                  style={{ fill: windowColor(r.state, light.daylight), transition: reduce ? undefined : "fill 450ms ease" }}
                  stroke={sel ? "var(--primary)" : "#20262f"}
                  strokeWidth={sel ? 2 : 0.8}
                />
                {r.setback && <rect x={w.x} y={w.y + w.h + 0.8} width={w.w} height={Math.max(1.5, w.h * 0.12)} fill="#5b85f0" />}
              </g>
            );
          })}
        </svg>

        <RoomInspector room={room} day={day} rooms={rooms.length} conditions={displayed.conditions} outdoorF={hourState.outdoorTempF} heatingKW={hourState.demandKW.heating} coolingKW={hourState.demandKW.cooling} hour={hour} onClose={() => setPicked(null)} />
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: windowColor("occupied", 0) }} /> Guest in room</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: windowColor("away", 0) }} /> Booked, guest out</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-glass-border" style={{ background: windowColor("vacant", 0) }} /> Vacant</li>
        <li className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-sm bg-[#5b85f0]" /> Set back (smart controls)</li>
        <li>Windows show glass by day and glow at night (modeled sun).</li>
      </ul>
    </div>
  );
}

function RoomInspector({
  room,
  day,
  rooms,
  conditions,
  outdoorF,
  heatingKW,
  coolingKW,
  hour,
  onClose,
}: {
  room: RoomPoint | undefined;
  day: ReturnType<typeof typicalDayByZoneEndUse>;
  rooms: number;
  conditions: ReturnType<typeof selectDisplayed>["conditions"];
  outdoorF: number;
  heatingKW: number;
  coolingKW: number;
  hour: number;
  onClose: () => void;
}) {
  if (!room) {
    return (
      <aside className="rounded-xl border border-glass-border bg-glass p-3 text-xs text-muted-foreground" aria-live="polite">
        Click a window (or focus the façade and use the arrow keys) to inspect a room.
      </aside>
    );
  }
  const sp = conditions.setpoints;
  const setBack = room.setback;
  const heat = setBack ? sp.vacantHeatF : sp.occupiedHeatF;
  const cool = setBack ? sp.vacantCoolF : sp.occupiedCoolF;
  const h = Math.max(0, Math.min(23, Math.round(hour)));
  const zoneKW = END_USES.reduce((s, u) => s + (day[`guest_rooms|${u}`]?.elecKW[h] ?? 0) + (day[`guest_rooms|${u}`]?.gasThermsPerHour[h] ?? 0) * 29.3071, 0);
  const hvacKW = (["heating", "cooling", "ventilation"] as const).reduce((s, u) => s + (day[`guest_rooms|${u}`]?.elecKW[h] ?? 0) + (day[`guest_rooms|${u}`]?.gasThermsPerHour[h] ?? 0) * 29.3071, 0);
  const mode = heatingKW > coolingKW * 1.2 ? "heating" : coolingKW > heatingKW * 1.2 ? "cooling" : "mild (little heating or cooling)";
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 2 : 1 });
  return (
    <aside className="rounded-xl border border-glass-border bg-glass p-3 text-sm" aria-live="polite" data-testid="room-inspector">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">Room {room.number}</div>
          <div className="text-xs text-muted-foreground">Floor {room.floor}</div>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Occupancy</dt><dd className="text-right">{STATE_TEXT[room.state]}</dd></div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">HVAC mode</dt>
          <dd className="text-right">{setBack ? "Set back by smart controls" : room.state === "occupied" ? "Comfort" : conditions.smartRoomControls ? "Comfort" : "Comfort (no smart controls)"}</dd>
        </div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Setpoints</dt><dd className="text-right tabular-nums">heat {heat}°F · cool {cool}°F</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Outdoor (modeled)</dt><dd className="text-right tabular-nums">{Math.round(outdoorF)}°F · {mode}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Guest-room average</dt><dd className="text-right tabular-nums">{fmt(zoneKW / Math.max(1, rooms))} kW ({fmt(hvacKW / Math.max(1, rooms))} kW HVAC)</dd></div>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Average per room this hour: the model works per zone, not per room, so this is the guest-room total divided by {rooms} rooms. Modeled estimate.
      </p>
    </aside>
  );
}
