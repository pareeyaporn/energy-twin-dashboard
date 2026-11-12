import { Pause, Play } from "lucide-react";
import { MONTH_LABELS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectMeter } from "@/store/hotelDerived";
import { hourLabel, monthLabel, usd } from "../format";

const SPEEDS = [1, 2, 4];

/** Day or year playback, a scrubber, and the simulated meter. Time only moves the view; nothing here computes energy. */
export function TimeControls() {
  const mode = useTwin((s) => s.timeMode);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);
  const playing = useTwin((s) => s.playing);
  const speed = useTwin((s) => s.playbackSpeed);
  const setTime = useTwin((s) => s.setTime);
  const setPlaying = useTwin((s) => s.setPlaying);
  const setSpeed = useTwin((s) => s.setPlaybackSpeed);
  const meter = useTwin(selectMeter);
  const displayed = useTwin(selectDisplayed);
  const monthCost = displayed.result.months[month]?.totals.cost ?? 0;
  const reduce = useTwin((s) => s.reduceEffects);

  const day = mode === "day" || mode === "seasons";
  return (
    <section aria-label="Time controls" className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time mode" className="flex overflow-hidden rounded-lg border border-glass-border text-sm">
          {(["seasons", "day", "year"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setTime({ mode: m })}
              className={`px-3 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {m === "day" ? "Typical day" : m === "year" ? "Year" : "Year + day"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div role="group" aria-label="Playback speed" className="flex gap-1 text-xs">
          {SPEEDS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={speed === n}
              onClick={() => setSpeed(n)}
              className={`rounded-md px-2 py-1 ${speed === n ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {n}x
            </button>
          ))}
        </div>
        {day && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Month
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => setTime({ month: Number(e.target.value) })}
              className="rounded-md border border-glass-border bg-background px-1.5 py-1 text-foreground"
            >
              {MONTH_LABELS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          aria-label={day ? "Hour of day" : "Month of year"}
          min={0}
          max={day ? 23 : 11}
          step={1}
          value={day ? hour : month}
          onChange={(e) => setTime(day ? { hour: Number(e.target.value) } : { month: Number(e.target.value) })}
          className="h-1.5 flex-1 accent-primary"
        />
        <span className="w-32 whitespace-nowrap text-right text-sm tabular-nums" data-testid="clock-label">
          {day ? `${monthLabel(month)} · ${hourLabel(hour)}` : monthLabel(month)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="meter">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <span className={`h-2 w-2 rounded-full bg-savings ${playing && !reduce ? "animate-pulse" : ""}`} aria-hidden="true" />
          Simulated meter
        </span>
        {day ? (
          <>
            <span className="tabular-nums">{meter.kW.toFixed(1)} kW</span>
            <span className="tabular-nums">{meter.thermsPerHour.toFixed(1)} therms/h</span>
            <span className="tabular-nums">{usd(meter.usdPerHour)} / hour</span>
          </>
        ) : (
          <span className="tabular-nums">{usd(monthCost)} in {monthLabel(month)}</span>
        )}
        <span className="text-xs text-muted-foreground">Modeled values, not measurements.</span>
      </div>
    </section>
  );
}
