import { motion } from "framer-motion";
import { useTwin } from "@/store/useTwin";
import { StageOverlays } from "./StageOverlays";

function HouseOutline({ thermal, still }: { thermal: boolean; still: boolean }) {
  const stroke = thermal ? "url(#thermal)" : "var(--primary)";
  return (
    <svg viewBox="0 0 320 260" className={`h-auto w-[min(420px,60%)] ${still ? "" : "animate-float"}`} role="img" aria-label="House outline placeholder">
      <defs>
        <linearGradient id="thermal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--efficient)" /><stop offset="55%" stopColor="var(--heat)" /><stop offset="100%" stopColor="var(--loss)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${thermal ? "var(--heat)" : "var(--primary)"})`, transition: "all 400ms" }}>
        {/* walls: left face and right face */}
        <path d="M60 130 L160 180 L160 250 L60 200 Z" />
        <path d="M160 180 L270 125 L270 195 L160 250 Z" />
        {/* roof */}
        <path d="M60 130 L110 60 L215 10 L270 125" />
        <path d="M110 60 L160 180" /><path d="M215 10 L160 180" opacity=".0" />
        <path d="M60 130 L110 60 L160 180 Z" />
        <path d="M110 60 L215 10 L270 125 L160 180 Z" />
        {/* windows */}
        <path d="M78 160 L100 171 L100 191 L78 180 Z" />
        <path d="M185 185 L210 172 L210 192 L185 205 Z" />
        <path d="M225 165 L250 152 L250 172 L225 185 Z" />
        {/* door */}
        <path d="M120 185 L140 195 L140 230 L120 220 Z" />
      </g>
    </svg>
  );
}

export function Stage() {
  const { thermalMode, reduceEffects } = useTwin();
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-stage-gradient">
      <div className="pointer-events-none absolute inset-x-[-30%] bottom-[-20%] h-[70%] stage-grid" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,var(--background)_100%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pb-16">
        <motion.div layout className="relative flex w-full justify-center">
          <HouseOutline thermal={thermalMode} still={reduceEffects} />
        </motion.div>
        <p className="text-sm text-text-muted">3D house coming soon</p>
      </div>
      <StageOverlays />
    </div>
  );
}
