import { useTwin } from "@/store/useTwin";
import { selectRooms } from "@/store/hotelDerived";
import { hourLabel, monthLabel } from "../format";

const STATE_CLASS = {
  occupied: "bg-primary",
  away: "bg-heat/70",
  vacant: "bg-muted",
} as const;

const STATE_TEXT = { occupied: "guest in room", away: "booked, guest out", vacant: "vacant" } as const;

/** Every room by floor: booked with a guest present, booked with the guest out, or vacant; a ring marks rooms set back by smart controls. */
export function RoomGrid() {
  const rooms = useTwin(selectRooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);

  const counts = { occupied: 0, away: 0, vacant: 0, setback: 0 };
  for (const r of rooms) {
    counts[r.state] += 1;
    if (r.setback) counts.setback += 1;
  }
  const booked = counts.occupied + counts.away;
  const byFloor = Array.from({ length: floors }, (_, i) => floors - i).map((f) => ({ floor: f, rooms: rooms.filter((r) => r.floor === f) }));

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
      <div className="space-y-1.5" role="img" aria-label={`Room map: ${booked} of ${rooms.length} booked, ${counts.occupied} with a guest present, ${counts.setback} set back`}>
        {byFloor.map(({ floor, rooms: fr }) => (
          <div key={floor} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">Floor {floor}</span>
            <div className="flex flex-wrap gap-1">
              {fr.map((r) => (
                <span
                  key={r.index}
                  title={`Room ${r.number}: ${STATE_TEXT[r.state]}${r.setback ? ", set back" : ""}`}
                  className={`h-4 w-4 rounded-sm ${STATE_CLASS[r.state]} ${r.setback ? "ring-2 ring-efficient" : ""}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Guest in room</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-heat/70" /> Booked, guest out</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted" /> Vacant</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted ring-2 ring-efficient" /> Set back (smart controls)</li>
      </ul>
    </div>
  );
}
