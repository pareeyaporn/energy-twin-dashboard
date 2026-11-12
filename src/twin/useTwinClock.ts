import { useEffect } from "react";
import { useTwin } from "@/store/useTwin";

/** Milliseconds per step at 1x: an hour in "day" mode, a month in "year" mode, an hour in "seasons" mode (a month's day in about 4 s). */
export const CLOCK_STEP_MS = { day: 900, year: 900, seasons: 4000 / 24 } as const;

/**
 * The playback clock. While `playing`, advance the hour (day), the month (year), or the hour and then the month (seasons: each month
 * plays one compressed day, a full year in about 48 s at 1x). The clock lives here, in the UI, so the engine and the store stay free of timers.
 */
export function useTwinClock(): void {
  const playing = useTwin((s) => s.playing);
  const speed = useTwin((s) => s.playbackSpeed);
  const mode = useTwin((s) => s.timeMode);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const { timeMode, timeHour, timeMonth, setTime } = useTwin.getState();
      if (timeMode === "day") setTime({ hour: (timeHour + 1) % 24 });
      else if (timeMode === "year") setTime({ month: (timeMonth + 1) % 12 });
      else if (timeHour >= 23) setTime({ hour: 0, month: (timeMonth + 1) % 12 });
      else setTime({ hour: timeHour + 1 });
    }, CLOCK_STEP_MS[mode] / Math.max(0.25, speed));
    return () => clearInterval(id);
  }, [playing, speed, mode]);
}
