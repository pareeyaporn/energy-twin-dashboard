// Pedestrians around the hotel. How many there are follows the engine: guests who are booked but out at this hour
// (`selectHourState().rooms`), so the street is busy when guests are out and quiet at night. Their walking is illustrative.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTwin } from "@/store/useTwin";
import { selectHourState } from "@/store/hotelDerived";

const COATS = ["#2f4d7a", "#7a2f3a", "#3c5a45", "#5b4a7a", "#8a6a3a", "#3a3f48", "#a8553a", "#2a6f78"];
const SUMMER = ["#e2c35a", "#5fa3d8", "#e07a5f", "#81b29a", "#f2f0e8", "#c77dff", "#f4a261", "#90be6d"];
const SKIN = ["#f1c9a5", "#c68e6a", "#8d5a3b", "#e0ac83", "#5c3a28"];

function hash(n: number): number {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

/** How many people to draw on the street and at the entrance, from guests out. */
export function pedestrianCounts(guestsOut: number, rooms: number): { street: number; entrance: number } {
  const share = rooms > 0 ? guestsOut / rooms : 0;
  return {
    street: Math.max(0, Math.min(12, Math.round(share * 30))),
    entrance: guestsOut > 0 ? Math.max(1, Math.min(4, Math.round(share * 10))) : 0,
  };
}

interface Walker {
  kind: "street" | "entrance";
  seed: number;
}

function Person({ w, coat, skin, path }: { w: Walker; coat: string; skin: string; path: (t: number, seed: number) => { x: number; z: number; heading: number; scale: number } }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const reduce = useTwin((s) => s.reduceEffects);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = reduce ? 3 : clock.getElapsedTime();
    const p = path(t, w.seed);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.heading;
    g.scale.setScalar(p.scale * 1.25);
    const swing = reduce ? 0 : Math.sin(t * 7 + w.seed * 10) * 0.45;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });
  return (
    <group ref={root}>
      <mesh ref={legL} position={[0.03, 0.15, 0]} castShadow>
        <boxGeometry args={[0.035, 0.16, 0.04]} />
        <meshStandardMaterial color="#23262d" />
      </mesh>
      <mesh ref={legR} position={[-0.03, 0.15, 0]} castShadow>
        <boxGeometry args={[0.035, 0.16, 0.04]} />
        <meshStandardMaterial color="#23262d" />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.11, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.425, 0]} castShadow>
        <sphereGeometry args={[0.042, 10, 8]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function People({ width, depth, sidewalkZ, winter }: { width: number; depth: number; sidewalkZ: number; winter: boolean }) {
  const rooms = useTwin((s) => selectHourState(s).rooms);
  const counts = pedestrianCounts(rooms.booked - rooms.present, rooms.total);
  const walkers = useMemo<Walker[]>(
    () => [
      ...Array.from({ length: counts.street }, (_, i) => ({ kind: "street" as const, seed: i + 1 })),
      ...Array.from({ length: counts.entrance }, (_, i) => ({ kind: "entrance" as const, seed: 100 + i })),
    ],
    [counts.street, counts.entrance],
  );
  const doorX = -width / 4;
  const doorZ = depth / 2 + 0.55;
  const path = useMemo(
    () => (t: number, seed: number) => {
      if (seed < 100) {
        // Along the sidewalk, both directions, wrapping at the ends.
        const dir = seed % 2 === 0 ? 1 : -1;
        const L = 40;
        const speed = 0.28 + hash(seed) * 0.18;
        const x = ((((hash(seed + 7) * L + t * speed) % L) + L) % L) - L / 2;
        return { x: dir * x, z: sidewalkZ + (dir === 1 ? -0.3 : 0.3), heading: dir === 1 ? Math.PI / 2 : -Math.PI / 2, scale: 1 };
      }
      // From the sidewalk up the path to the door (and in), then again.
      const period = 14 + hash(seed) * 6;
      const k = (((t + hash(seed + 3) * period) % period) + period) % period / period;
      const inbound = seed % 2 === 0;
      const u = inbound ? k : 1 - k;
      const z = sidewalkZ - 0.6 + (doorZ - (sidewalkZ - 0.6)) * u;
      const fade = u > 0.92 ? Math.max(0, (1 - u) / 0.08) : 1;
      return { x: doorX + (seed % 3 - 1) * 0.18, z, heading: inbound ? Math.PI : 0, scale: fade };
    },
    [sidewalkZ, doorX, doorZ],
  );
  const palette = winter ? COATS : SUMMER;
  return (
    <group>
      {walkers.map((w) => (
        <Person key={w.seed} w={w} coat={palette[Math.floor(hash(w.seed + 11) * palette.length)]!} skin={SKIN[Math.floor(hash(w.seed + 5) * SKIN.length)]!} path={path} />
      ))}
    </group>
  );
}
