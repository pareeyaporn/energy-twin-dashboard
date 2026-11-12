import { useEffect, useRef, useState } from "react";

/** True when the user's system allows motion (and the browser can tell). Without that signal, numbers change instantly. */
function motionAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: no-preference)").matches === true;
}

/**
 * Animates a displayed number from its previous value to `value` over `ms` (ease-out). The number itself comes from the store; this
 * only eases the display. Instant when `reduce` is on, when the system asks for reduced motion, and on the first render.
 */
export function useCountUp(value: number, reduce: boolean, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (reduce || !motionAllowed() || start === value || !Number.isFinite(start)) {
      from.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = start + (value - start) * (1 - (1 - k) ** 3);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce, ms]);
  return shown;
}
