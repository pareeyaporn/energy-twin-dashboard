import { useEffect } from "react";
import { useTwin } from "@/store/useTwin";

/**
 * The playback clock. While `playing`, advance the hour (day mode) or the month (year mode) at the chosen speed.
 * The clock lives here, in the UI, so the engine and the store stay free of timers.
 */
export function useTwinClock(): void {
  const playing = useTwin((s) => s.playing);
  const speed = useTwin((s) => s.playbackSpeed);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const { timeMode, timeHour, timeMonth, setTime } = useTwin.getState();
      if (timeMode === "day") setTime({ hour: (timeHour + 1) % 24 });
      else setTime({ month: (timeMonth + 1) % 12 });
    }, 900 / Math.max(0.25, speed));
    return () => clearInterval(id);
  }, [playing, speed]);
}
