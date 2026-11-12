// Street scenery in front of the hotel: sidewalk, road, cars and streetlights. Visual only (traffic is not modeled).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTwin } from "@/store/useTwin";

export interface StreetGeometry {
  /** z of the sidewalk center, the road center and the far sidewalk. */
  sidewalkZ: number;
  roadZ: number;
  farSidewalkZ: number;
  length: number;
}

/** Where the street runs, from the building's depth. */
export function streetGeometry(depth: number): StreetGeometry {
  return { sidewalkZ: depth / 2 + 6.3, roadZ: depth / 2 + 8.3, farSidewalkZ: depth / 2 + 10.3, length: 160 };
}

const CAR_COLORS = ["#c8ccd2", "#22252b", "#8a1f24", "#2f4d7a", "#e8e6e1", "#4f5a52"];

function Car({ color, night }: { color: string; night: number }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[1.1, 0.2, 0.5]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[-0.05, 0.32, 0]} castShadow>
        <boxGeometry args={[0.6, 0.15, 0.44]} />
        <meshStandardMaterial color="#1a2230" metalness={0.7} roughness={0.15} />
      </mesh>
      {[-0.36, 0.36].map((x) =>
        [-0.24, 0.24].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 10]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        )),
      )}
      {/* Headlights and taillights, brighter at night */}
      {[-0.15, 0.15].map((z) => (
        <group key={z}>
          <mesh position={[0.555, 0.17, z]}>
            <boxGeometry args={[0.02, 0.05, 0.09]} />
            <meshBasicMaterial color={new THREE.Color("#fff4d0").multiplyScalar(0.5 + night)} toneMapped={false} />
          </mesh>
          <mesh position={[-0.555, 0.17, z]}>
            <boxGeometry args={[0.02, 0.05, 0.09]} />
            <meshBasicMaterial color={new THREE.Color("#ff2a2a").multiplyScalar(0.4 + night)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MovingCar({ lane, dir, offset, speed, color, length, night }: { lane: number; dir: 1 | -1; offset: number; speed: number; color: string; length: number; night: number }) {
  const ref = useRef<THREE.Group>(null);
  const reduce = useTwin((s) => s.reduceEffects);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = reduce ? 0 : clock.getElapsedTime();
    const x = ((((offset + t * speed) % length) + length) % length) - length / 2;
    g.position.set(dir * x, 0, lane);
  });
  return (
    <group ref={ref} rotation={[0, dir === 1 ? 0 : Math.PI, 0]}>
      <Car color={color} night={night} />
    </group>
  );
}

export function Street({ depth, snow, night }: { depth: number; snow: boolean; night: number }) {
  const g = useMemo(() => streetGeometry(depth), [depth]);
  const lights = useMemo(() => Array.from({ length: 13 }, (_, i) => -36 + i * 6), []);
  const walk = snow ? "#dfe5ec" : "#a7a9ad";
  return (
    <group>
      {/* Sidewalks and road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, g.sidewalkZ]} receiveShadow>
        <planeGeometry args={[g.length, 1.4]} />
        <meshStandardMaterial color={walk} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, g.roadZ]} receiveShadow>
        <planeGeometry args={[g.length, 2.7]} />
        <meshStandardMaterial color={snow ? "#5d636b" : "#3a3d42"} roughness={0.9} />
      </mesh>
      {Array.from({ length: Math.floor(g.length / 3) }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-g.length / 2 + 1.5 + i * 3, 0.014, g.roadZ]}>
          <planeGeometry args={[1.2, 0.06]} />
          <meshBasicMaterial color="#e9e3c9" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, g.farSidewalkZ]} receiveShadow>
        <planeGeometry args={[g.length, 1.4]} />
        <meshStandardMaterial color={walk} roughness={0.95} />
      </mesh>
      {/* Streetlights with a warm pool of light at night */}
      {lights.map((x) => (
        <group key={x} position={[x, 0, g.sidewalkZ + 0.55]}>
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 1.3, 6]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.3, -0.12]}>
            <boxGeometry args={[0.14, 0.05, 0.3]} />
            <meshStandardMaterial color="#2b2f36" emissive="#ffd38a" emissiveIntensity={night * 2.5} />
          </mesh>
          {night > 0.3 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -0.3]}>
              <circleGeometry args={[0.9, 24]} />
              <meshBasicMaterial color="#ffcf80" transparent opacity={0.16 * night} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* Traffic: two lanes, deterministic offsets */}
      {[0, 1, 2, 3, 4].map((i) => (
        <MovingCar key={`a${i}`} lane={g.roadZ - 0.65} dir={1} offset={i * 31} speed={2.2 + i * 0.3} color={CAR_COLORS[i % CAR_COLORS.length]!} length={g.length} night={night} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <MovingCar key={`b${i}`} lane={g.roadZ + 0.65} dir={-1} offset={11 + i * 41} speed={2.5 + i * 0.4} color={CAR_COLORS[(3 + i) % CAR_COLORS.length]!} length={g.length} night={night} />
      ))}
    </group>
  );
}
