// The 3D hotel. A visualization layer only: every energy number and color comes from the store (which calls the engine);
// the scenery (trees, snow, sky) follows the calendar and the sun's position. Lazy-loaded by the twin, client-side only.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Html, Sky, Stars } from "@react-three/drei";
import { People } from "./People";
import { Street, streetGeometry } from "./Street";
import * as THREE from "three";
import { ZONE_IDS, ZONE_LABELS, upgradeDef } from "@/engine/hotel";
import type { ZoneId } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectHourState, selectRooms } from "@/store/hotelDerived";
import { SCENE_COLORS, sceneIntensityColor } from "./colors";
import { lightingFor, sceneryFor, sunVector } from "./environment";
import { buildingLayout, cameraViews, solarSlotCount } from "./layout";
import type { CameraView } from "./layout";
import type { Box } from "./layout";

export interface HotelSceneHandle {
  resetCamera: () => void;
}

interface Props {
  exploded: boolean;
  /** Cost colors on every zone (otherwise a realistic look, with the cost color on the selected zone only). */
  energyView: boolean;
  solarSelected: boolean;
  onSelectSolar: (on: boolean) => void;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function useZoneColors(): Record<ZoneId, string> {
  const result = useTwin((s) => selectDisplayed(s).result);
  return useMemo(() => {
    const costs = ZONE_IDS.map((z) => result.byZone[z].cost);
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    const out = {} as Record<ZoneId, string>;
    for (const z of ZONE_IDS) out[z] = sceneIntensityColor(max > min ? (result.byZone[z].cost - min) / (max - min) : 0.5);
    return out;
  }, [result]);
}

/** Realistic materials (used when the energy view is off). Visual only. */
const REAL: Record<ZoneId, { color: string; metalness: number; roughness: number }> = {
  guest_rooms: { color: "#e2d6c2", metalness: 0.02, roughness: 0.85 },
  lobby_common: { color: "#39414d", metalness: 0.3, roughness: 0.4 },
  kitchen_restaurant: { color: "#4a3f38", metalness: 0.1, roughness: 0.6 },
  hallways_shared: { color: "#bdb3a4", metalness: 0.02, roughness: 0.9 },
  central_hvac: { color: "#9aa3ad", metalness: 0.6, roughness: 0.35 },
  hot_water: { color: "#8b949c", metalness: 0.5, roughness: 0.4 },
};

/**
 * One box that belongs to a zone: clickable, highlighted when selected. With the energy view on it takes its cost color; otherwise a
 * realistic material, except the selected zone, which shows its cost color. Colors fade smoothly unless effects are reduced.
 */
function ZoneBox({ box, zone, color, energy, glow, opacity = 1, onPick }: { box: Box; zone: ZoneId; color: string; energy: boolean; glow?: { color: string; intensity: number } | undefined; opacity?: number; onPick?: () => void }) {
  const selected = useTwin((s) => s.selectedZone === zone);
  const selectZone = useTwin((s) => s.selectZone);
  const reduce = useTwin((s) => s.reduceEffects);
  const [hover, setHover] = useState(false);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const real = REAL[zone];
  const showCost = energy || selected;
  const target = useMemo(() => new THREE.Color(showCost ? color : real.color), [showCost, color, real.color]);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    if (reduce) m.color.copy(target);
    else m.color.lerp(target, Math.min(1, dt * 4));
    m.metalness = showCost ? 0.05 : real.metalness;
    m.roughness = showCost ? 0.55 : real.roughness;
  });
  const emissive = selected ? "#ffffff" : hover ? color : glow ? glow.color : "#000000";
  const emissiveIntensity = selected ? 0.18 : hover ? 0.2 : glow ? glow.intensity : 0;
  return (
    <mesh
      position={[box.x, box.y, box.z]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onPick?.();
        selectZone(selected ? null : zone);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <boxGeometry args={[box.w, box.h, box.d]} />
      <meshStandardMaterial ref={mat} color={real.color} transparent={opacity < 1} opacity={opacity} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
}

/** Guest-room windows, one per room, colored by the room's state at the current hour (from the engine's room pattern). */
function Windows({ layout, lift }: { layout: ReturnType<typeof buildingLayout>; lift: (floor: number) => number }) {
  const rooms = useTwin(selectRooms);
  const ref = useRef<THREE.InstancedMesh>(null);
  const daylight = useTwin((s) => lightingFor(selectHourState(s).sunElevationDeg, "summer").daylight);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const lit = new THREE.Color(SCENE_COLORS.windowLit);
    const away = new THREE.Color(SCENE_COLORS.windowAway);
    const dark = new THREE.Color(SCENE_COLORS.windowDark);
    const day = new THREE.Color("#a8c4e6");
    layout.windows.forEach((w, i) => {
      m.makeTranslation(w.x, w.y + lift(w.floor), w.z);
      mesh.setMatrixAt(i, m);
      const state = rooms[w.index]?.state ?? "vacant";
      const base = state === "occupied" ? lit : state === "away" ? away : dark;
      // In daylight windows read as glass; the room state shows through more strongly at night.
      c.copy(base).lerp(day, daylight * (state === "occupied" ? 0.45 : 0.7));
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [layout, rooms, daylight, lift]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, layout.windows.length]}>
      <planeGeometry args={[0.36, 0.5]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/** Rooms that smart controls have set back (away or vacant, from the engine's room pattern) get a blue sill under the window. */
function SetbackMarks({ layout, lift }: { layout: ReturnType<typeof buildingLayout>; lift: (floor: number) => number }) {
  const rooms = useTwin(selectRooms);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    layout.windows.forEach((w, i) => {
      if (rooms[w.index]?.setback) {
        m.makeTranslation(w.x, w.y - 0.3 + lift(w.floor), w.z + w.side * 0.01);
        mesh.setMatrixAt(i, m);
      } else mesh.setMatrixAt(i, hidden);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [layout, rooms, lift]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, layout.windows.length]}>
      <planeGeometry args={[0.4, 0.07]} />
      <meshBasicMaterial color={SCENE_COLORS.setbackRing} side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/** Architectural detail (no data): window frames, floor slab bands, a roof parapet, podium shopfronts and an entrance canopy. */
function Facade({ layout, lift, top, gap }: { layout: ReturnType<typeof buildingLayout>; lift: (floor: number) => number; top: number; gap: number }) {
  const frames = useRef<THREE.InstancedMesh>(null);
  const daylight = useTwin((s) => lightingFor(selectHourState(s).sunElevationDeg, "summer").daylight);
  useLayoutEffect(() => {
    const mesh = frames.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    layout.windows.forEach((w, i) => {
      m.makeTranslation(w.x, w.y + lift(w.floor), w.z - w.side * 0.004);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [layout, lift]);
  const { width: W, depth: D } = layout;
  const night = 1 - daylight;
  const shop = new THREE.Color("#9fb4d9").lerp(new THREE.Color("#ffd99a"), night).getStyle();
  const bands = layout.guestFloors.map((f, i) => f.y - f.h / 2 + i * gap);
  const lobby = layout.podium.lobby;
  const kitchen = layout.podium.kitchen;
  return (
    <group>
      <instancedMesh ref={frames} args={[undefined, undefined, layout.windows.length]}>
        <planeGeometry args={[0.46, 0.6]} />
        <meshStandardMaterial color="#20262f" side={THREE.DoubleSide} roughness={0.8} />
      </instancedMesh>
      {bands.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[W + 0.08, 0.07, D + 0.08]} />
          <meshStandardMaterial color="#d9d4cb" roughness={0.9} />
        </mesh>
      ))}
      {/* Parapet */}
      {(
        [
          [0, D / 2 + 0.03, W + 0.12, 0.06],
          [0, -D / 2 - 0.03, W + 0.12, 0.06],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`p${i}`} position={[x, top + 0.14, z]} castShadow>
          <boxGeometry args={[w, 0.22, d]} />
          <meshStandardMaterial color="#cfc9bf" />
        </mesh>
      ))}
      {[W / 2 + 0.03, -W / 2 - 0.03].map((x, i) => (
        <mesh key={`q${i}`} position={[x, top + 0.14, 0]} castShadow>
          <boxGeometry args={[0.06, 0.22, D + 0.12]} />
          <meshStandardMaterial color="#cfc9bf" />
        </mesh>
      ))}
      {/* Shopfronts: glass that glows warm at night (lobby and restaurant are open) */}
      {[lobby, kitchen].map((b, i) => (
        <mesh key={`g${i}`} position={[b.x, b.h * 0.45, b.d / 2 + 0.012]}>
          <planeGeometry args={[b.w * 0.86, b.h * 0.62]} />
          <meshStandardMaterial color={shop} emissive={shop} emissiveIntensity={0.15 + 0.75 * night} metalness={0.2} roughness={0.15} />
        </mesh>
      ))}
      {/* Entrance canopy and doors */}
      <mesh position={[lobby.x, lobby.h * 0.85, lobby.d / 2 + 0.45]} castShadow>
        <boxGeometry args={[1.9, 0.07, 0.9]} />
        <meshStandardMaterial color="#2a3446" metalness={0.4} />
      </mesh>
      <mesh position={[lobby.x, lobby.h * 0.35, lobby.d / 2 + 0.02]}>
        <planeGeometry args={[0.9, 0.7]} />
        <meshStandardMaterial color="#1b2230" emissive="#ffcf7a" emissiveIntensity={0.1 + 0.6 * night} />
      </mesh>
    </group>
  );
}

function Fan({ x, y, z, speed }: { x: number; y: number; z: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduce = useTwin((s) => s.reduceEffects);
  useFrame((_, dt) => {
    if (ref.current && !reduce) ref.current.rotation.y += dt * (1 + 8 * speed);
  });
  return (
    <mesh ref={ref} position={[x, y, z]}>
      <boxGeometry args={[0.9, 0.04, 0.12]} />
      <meshStandardMaterial color="#c9d3e3" />
    </mesh>
  );
}

function Trees({ width, depth, foliage, evergreen, snow }: { width: number; depth: number; foliage: string | null; evergreen: string; snow: boolean }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number; s: number; kind: "round" | "cone" }[] = [];
    const ring = [
      [-width / 2 - 2.2, depth / 2 + 2.5],
      [-width / 2 - 1, depth / 2 + 4],
      [width / 2 + 2.6, depth / 2 + 3.2],
      [width / 2 + 3.6, -depth / 2 - 1.5],
      [-width / 2 - 3, -depth / 2 - 2],
      [0.6, depth / 2 + 4.1],
      [-3.2, depth / 2 + 4.4],
      [width / 2 + 0.8, depth / 2 + 4.3],
      [-width / 2 - 4.2, 0.6],
      [width / 2 + 4.5, 1.2],
    ];
    ring.forEach(([x, z], i) => out.push({ x: x ?? 0, z: z ?? 0, s: 0.8 + ((i * 37) % 10) / 25, kind: i % 3 === 0 ? "cone" : "round" }));
    return out;
  }, [width, depth]);
  return (
    <group>
      {spots.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 1, 6]} />
            <meshStandardMaterial color="#5a4330" />
          </mesh>
          {t.kind === "cone" ? (
            <mesh position={[0, 1.4, 0]} castShadow>
              <coneGeometry args={[0.6, 1.6, 7]} />
              <meshStandardMaterial color={snow ? "#dfe8ee" : evergreen} />
            </mesh>
          ) : foliage ? (
            <mesh position={[0, 1.35, 0]} castShadow>
              <icosahedronGeometry args={[0.65, 0]} />
              <meshStandardMaterial color={foliage} flatShading />
            </mesh>
          ) : (
            // Bare tree in winter: a few branches.
            [0.4, 1.2, 2.1].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.22, 1.15, Math.sin(a) * 0.22]} rotation={[0, a, 0.7]}>
                <cylinderGeometry args={[0.02, 0.04, 0.7, 4]} />
                <meshStandardMaterial color="#5a4330" />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}

/** Deterministic pseudo-random number in [0, 1) from an integer (no Math.random, so renders repeat). */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Snowfall({ area }: { area: number }) {
  const ref = useRef<THREE.Points>(null);
  const reduce = useTwin((s) => s.reduceEffects);
  const positions = useMemo(() => {
    const n = 700;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Deterministic spread (no Math.random), so renders are repeatable.
      a[i * 3] = (hash01(i * 3 + 1) - 0.5) * area;
      a[i * 3 + 1] = hash01(i * 3 + 2) * 12;
      a[i * 3 + 2] = (hash01(i * 3 + 3) - 0.5) * area;
    }
    return a;
  }, [area]);
  useFrame((_, dt) => {
    const p = ref.current;
    if (!p || reduce) return;
    const arr = p.geometry.attributes["position"]!.array as Float32Array;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] = (arr[i] ?? 0) - dt * 0.9;
      if ((arr[i] ?? 0) < 0) arr[i] = 12;
    }
    p.geometry.attributes["position"]!.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.07} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function Building({ exploded, solarSelected, onSelectSolar, energyView }: Props) {
  const rooms = useTwin((s) => s.hotel.profile.rooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const layout = useMemo(() => buildingLayout(rooms, floors), [rooms, floors]);
  const colors = useZoneColors();
  const hour = useTwin(selectHourState);
  const pkg = useTwin((s) => selectDisplayed(s).package);
  const month = useTwin((s) => s.timeMonth);
  const scenery = sceneryFor(month);
  const selectZone = useTwin((s) => s.selectZone);
  const gap = exploded ? 0.45 : 0;
  const lift = useMemo(() => (floor: number) => (floor - 1) * gap, [gap]);
  const top = layout.roofY + (layout.floors - 1) * gap;

  // HVAC unit tint: red when heating dominates this hour, blue when cooling does, mixed with its cost color.
  const hvac = hour.demandKW.heating + hour.demandKW.cooling;
  const heatShare = hvac > 0 ? hour.demandKW.heating / hvac : 0.5;
  const plantColor = new THREE.Color(colors.central_hvac).lerp(new THREE.Color(heatShare > 0.5 ? SCENE_COLORS.loss : "#4fc3ff"), Math.min(0.85, Math.abs(heatShare - 0.5) * 1.7)).getStyle();
  const fanSpeed = Math.min(1, hvac / Math.max(1, hour.demandKW.total));
  // In the realistic look the plant glows red (heating) or blue (cooling) by how strongly one dominates this hour.
  const plantGlow = { color: heatShare > 0.5 ? SCENE_COLORS.loss : "#4fc3ff", intensity: Math.min(0.6, Math.abs(heatShare - 0.5) * 1.1) };

  const solarIds = pkg?.evaluation.upgradeIds.filter((id) => id.startsWith("rooftop_solar")) ?? [];
  const installedFraction = solarIds[0] ? (upgradeDef(solarIds[0]).constants["roofFraction"] ?? 1) : 0;
  const installed = solarSlotCount(layout.solarSlots.length, installedFraction);
  const preview = !installed && solarSelected;

  return (
    <group>
      <ZoneBox box={layout.podium.lobby} zone="lobby_common" color={colors.lobby_common} energy={energyView} />
      <ZoneBox box={layout.podium.kitchen} zone="kitchen_restaurant" color={colors.kitchen_restaurant} energy={energyView} />
      {layout.guestFloors.map((f, i) => (
        <ZoneBox key={i} box={{ ...f, y: f.y + i * gap }} zone="guest_rooms" color={colors.guest_rooms} energy={energyView} opacity={exploded ? 0.82 : 1} />
      ))}
      <ZoneBox box={{ ...layout.core, y: layout.core.y + ((layout.floors - 1) * gap) / 2, h: layout.core.h + (layout.floors - 1) * gap }} zone="hallways_shared" color={colors.hallways_shared} energy={energyView} />
      <Windows layout={layout} lift={lift} />
      <SetbackMarks layout={layout} lift={lift} />
      <Facade layout={layout} lift={lift} top={top} gap={gap} />
      {/* Roof slab, snow-covered in winter */}
      <mesh position={[0, top + 0.03, 0]} receiveShadow>
        <boxGeometry args={[layout.width + 0.1, 0.06, layout.depth + 0.1]} />
        <meshStandardMaterial color={scenery.snowCover ? "#eef3f8" : SCENE_COLORS.structure} />
      </mesh>
      <ZoneBox box={{ ...layout.plant, y: top + 0.4 }} zone="central_hvac" color={plantColor} energy={energyView} glow={energyView ? undefined : plantGlow} />
      <Fan x={layout.plant.x} y={top + 0.83} z={layout.plant.z} speed={fanSpeed} />
      <ZoneBox box={layout.hotWater} zone="hot_water" color={colors.hot_water} energy={energyView} />
      {/* Solar: installed panels (solid), or a translucent full-roof preview when the solar zone is selected without an array */}
      {layout.solarSlots.slice(0, installed || (preview ? layout.solarSlots.length : 0)).map((b, i) => (
        <mesh
          key={i}
          position={[b.x, top + 0.14, b.z]}
          rotation={[-0.35, 0, 0]}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            selectZone(null);
            onSelectSolar(!solarSelected);
          }}
        >
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#1d3b6e" metalness={0.6} roughness={0.25} transparent={preview} opacity={preview ? 0.35 : 1} emissive={solarSelected ? "#3a6bd6" : "#000000"} emissiveIntensity={solarSelected ? 0.35 : 0} />
        </mesh>
      ))}
      {/* An invisible pad on the roof so the solar zone can be clicked even without panels */}
      {!installed && !preview && (
        <mesh
          position={[(layout.solarSlots[0]?.x ?? 0) + 1, top + 0.08, 0]}
          onClick={(e) => {
            e.stopPropagation();
            selectZone(null);
            onSelectSolar(true);
          }}
        >
          <boxGeometry args={[Math.max(1, layout.width - 3), 0.05, layout.depth - 0.4]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      <SelectionLabel layout={layout} top={top} gap={gap} solarSelected={solarSelected} />
    </group>
  );
}

function SelectionLabel({ layout, top, gap, solarSelected }: { layout: ReturnType<typeof buildingLayout>; top: number; gap: number; solarSelected: boolean }) {
  const zone = useTwin((s) => s.selectedZone);
  const result = useTwin((s) => selectDisplayed(s).result);
  const hour = useTwin(selectHourState);
  if (!zone && !solarSelected) return null;
  const pos: Record<ZoneId, [number, number, number]> = {
    guest_rooms: [-layout.width / 4, top - 0.4, layout.depth / 2 + 0.2],
    lobby_common: [layout.podium.lobby.x, 1.6, layout.depth / 2 + 0.5],
    kitchen_restaurant: [layout.podium.kitchen.x, 1.6, layout.depth / 2 + 0.5],
    hallways_shared: [0, layout.core.y + gap, layout.depth / 2 + 0.2],
    central_hvac: [layout.plant.x, top + 1.3, 0],
    hot_water: [layout.hotWater.x, 1.5, layout.hotWater.z],
  };
  const where: [number, number, number] = solarSelected ? [-layout.width / 4, top + 0.9, 0] : pos[zone!];
  const text = solarSelected
    ? hour.solar.installed
      ? `Rooftop solar · ${hour.solar.sizeKw.toFixed(0)} kW`
      : "Rooftop solar · not installed (preview)"
    : `${ZONE_LABELS[zone!]} · ${usd(result.byZone[zone!].cost)} / yr`;
  return (
    <Html position={where} center zIndexRange={[20, 0]}>
      <div className="pointer-events-none whitespace-nowrap rounded-md border border-glass-border bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground shadow">{text}</div>
    </Html>
  );
}

function Environment() {
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin(selectHourState);
  const reduce = useTwin((s) => s.reduceEffects);
  const scenery = sceneryFor(month);
  const light = lightingFor(hour.sunElevationDeg, scenery.season);
  const [sx, sy, sz] = sunVector(Math.max(hour.sunElevationDeg, 2), hour.sunAzimuthDeg);
  const rooms = useTwin((s) => s.hotel.profile.rooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const layout = useMemo(() => buildingLayout(rooms, floors), [rooms, floors]);
  // Fog starts just beyond the building at the home view, so taller hotels (camera further away) stay clear.
  const home = cameraViews(layout).home;
  const fogNear = Math.max(28, Math.hypot(...home.position) * 1.05);
  const shadowExt = Math.max(16, layout.roofY * 0.9 + 8);
  const street = streetGeometry(layout.depth);
  const night = 1 - light.daylight;
  // By day a physical sky (scattering from the sun's position); the horizon haze matches the fog so the ground fades into it.
  const showSky = light.daylight > 0.35;
  const haze = showSky ? new THREE.Color(light.sky).lerp(new THREE.Color("#dfe7ee"), 0.55).getStyle() : light.fog;
  return (
    <>
      <color attach="background" args={[light.sky]} />
      {showSky && <Sky distance={450} sunPosition={[sx, sy, sz]} turbidity={scenery.season === "winter" ? 9 : 6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.85} />}
      <fog attach="fog" args={[haze, fogNear, fogNear * 2.4]} />
      <ambientLight intensity={light.ambient} />
      <hemisphereLight args={[light.sky, scenery.ground, 0.25 + 0.35 * light.daylight]} />
      <directionalLight
        position={[sx * shadowExt * 2, sy * shadowExt * 2, sz * shadowExt * 2]}
        intensity={light.sunIntensity}
        color={light.sunColor}
        castShadow={!reduce}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowExt}
        shadow-camera-right={shadowExt}
        shadow-camera-top={shadowExt}
        shadow-camera-bottom={-shadowExt}
        shadow-camera-far={shadowExt * 5}
      />
      <directionalLight position={[-sx * 20, 18, -sz * 20]} intensity={light.moonIntensity} color="#9fb6ff" />
      {light.stars && !reduce && <Stars radius={60} depth={20} count={1200} factor={2.5} fade speed={0} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[Math.max(80, fogNear * 2.2), 64]} />
        <meshStandardMaterial color={scenery.ground} roughness={0.95} />
      </mesh>
      {/* A path to the entrance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-layout.width / 4, 0.01, layout.depth / 2 + 3]}>
        <planeGeometry args={[1.4, 5]} />
        <meshStandardMaterial color={scenery.snowCover ? "#c9d2dc" : "#8a8f99"} />
      </mesh>
      <Trees width={layout.width} depth={layout.depth} foliage={scenery.foliage} evergreen={scenery.evergreen} snow={scenery.snowCover} />
      <Street depth={layout.depth} snow={scenery.snowCover} night={night} />
      <People width={layout.width} depth={layout.depth} sidewalkZ={street.sidewalkZ} winter={scenery.season === "winter" || scenery.season === "fall"} />
      {scenery.snowfall && !reduce && <Snowfall area={36} />}
    </>
  );
}

/** The canvas. `ref.resetCamera()` puts the camera back to the default isometric view. */
/**
 * The camera: a short fly-in from a wide view when the scene opens, then a glide to whichever zone (or the roof, for solar) is selected,
 * and back to the home view when nothing is. Drag and zoom still work at any time. Instant (no animation) with "reduce effects".
 */
const CameraRig = forwardRef<HotelSceneHandle, { solarSelected: boolean }>(function CameraRig({ solarSelected }, ref) {
  const controls = useRef<CameraControls>(null);
  const rooms = useTwin((s) => s.hotel.profile.rooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const zone = useTwin((s) => s.selectedZone);
  const reduce = useTwin((s) => s.reduceEffects);
  const views = useMemo(() => cameraViews(buildingLayout(rooms, floors)), [rooms, floors]);
  const homeDist = Math.hypot(...views.home.position);
  const go = (v: CameraView, smooth: boolean) => {
    void controls.current?.setLookAt(...v.position, ...v.target, smooth);
  };
  const started = useRef(false);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!started.current) {
      started.current = true;
      if (reduce) return go(views.home, false);
      go(views.intro, false);
      c.smoothTime = 0.9;
      go(views.home, true);
      const t = setTimeout(() => {
        if (controls.current) controls.current.smoothTime = 0.45;
      }, 2200);
      return () => clearTimeout(t);
    }
    go(solarSelected ? views.focus.solar : zone ? views.focus[zone] : views.home, !reduce);
  }, [views, zone, solarSelected, reduce]);
  useImperativeHandle(ref, () => ({ resetCamera: () => go(views.home, !reduce) }), [views, reduce]);
  return (
    <CameraControls
      ref={controls}
      minDistance={4}
      maxDistance={Math.max(70, homeDist * 1.8)}
      maxPolarAngle={Math.PI / 2.08}
      smoothTime={0.45}
      draggingSmoothTime={reduce ? 0 : 0.12}
    />
  );
});

/** The canvas. `ref.resetCamera()` glides the camera back to the default view. */
const HotelScene = forwardRef<HotelSceneHandle, Props>(function HotelScene(props, ref) {
  const rooms = useTwin((s) => s.hotel.profile.rooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const home = useMemo(() => cameraViews(buildingLayout(rooms, floors)).home, [rooms, floors]);
  const reduce = useTwin((s) => s.reduceEffects);
  return (
    <Canvas
      shadows={!reduce}
      dpr={reduce ? 1 : [1, 1.75]}
      camera={{ position: home.position, fov: 38, near: 0.1, far: 600 }}
      onPointerMissed={() => {
        useTwin.getState().selectZone(null);
        props.onSelectSolar(false);
      }}
      aria-label="3D hotel"
    >
      <Environment />
      <Building {...props} />
      <CameraRig ref={ref} solarSelected={props.solarSelected} />
    </Canvas>
  );
});

export default HotelScene;
