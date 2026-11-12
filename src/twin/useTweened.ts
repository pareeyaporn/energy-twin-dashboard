import { useEffect, useRef, useState } from "react";
import { motionAllowed } from "./useCountUp";

/**
 * Eases a set of named numbers from their previous values to new ones (keys that appear start at 0, keys that vanish ease to 0 and
 * are then dropped). Display only: the values come from the engine. Instant with `reduce` or when the system asks for reduced motion.
 */
export function useTweened(target: Record<string, number>, reduce: boolean, ms = 600): Record<string, number> {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const signature = Object.entries(target)
    .map(([k, v]) => `${k}=${v.toPrecision(6)}`)
    .join("|");
  useEffect(() => {
    const from = current.current;
    if (reduce || !motionAllowed()) {
      current.current = target;
      setShown(target);
      return;
    }
    const keys = new Set([...Object.keys(from), ...Object.keys(target)]);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      const next: Record<string, number> = {};
      for (const key of keys) {
        const a = from[key] ?? 0;
        const b = target[key] ?? 0;
        const v = a + (b - a) * e;
        if (k < 1 || key in target) next[key] = v;
      }
      current.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reduce, ms]);
  return shown;
}
