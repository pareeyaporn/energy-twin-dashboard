// The 3D hotel. A visualization layer only: every energy number and color comes from the store (which calls the engine);
// the scenery (trees, snow, sky) follows the calendar and the sun's position. Lazy-loaded by the twin, client-side only.
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ZONE_IDS, ZONE_LABELS, upgradeDef } from "@/engine/hotel";
import type { ZoneId } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectHourState, selectRooms } from "@/store/hotelDerived";
import { SCENE_COLORS, sceneIntensityColor } from "./colors";
import { lightingFor, sceneryFor, sunVector } from "./environment";
import { buildingLayout, solarSlotCount } from "./layout";
import type { Box } from "./layout";

export interface HotelSceneHandle {
  resetCamera: () => void;
}

interface Props {
  exploded: boolean;
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

/** One box that belongs to a zone: clickable, highlighted when selected. */
function ZoneBox({ box, zone, color, opacity = 1, onPick }: { box: Box; zone: ZoneId; color: string; opacity?: number; onPick?: () => void }) {
  const selected = useTwin((s) => s.selectedZone === zone);
  const selectZone = useTwin((s) => s.selectZone);
  const [hover, setHover] = useState(false);
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
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.55}
        metalness={0.05}
        emissive={selected ? "#ffffff" : hover ? color : "#000000"}
        emissiveIntensity={selected ? 0.25 : hover ? 0.2 : 0}
      />
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
      [0.5, depth / 2 + 4.8],
      [-3, depth / 2 + 5.4],
      [width / 2 + 0.8, depth / 2 + 5.2],
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

function Snowfall({ area }: { area: number }) {
  const ref = useRef<THREE.Points>(null);
  const reduce = useTwin((s) => s.reduceEffects);
  const positions = useMemo(() => {
    const n = 700;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Deterministic spread (no Math.random), so renders are repeatable.
      a[i * 3] = (((i * 7919) % 1000) / 1000 - 0.5) * area;
      a[i * 3 + 1] = ((i * 104729) % 1000) / 1000 * 12;
      a[i * 3 + 2] = (((i * 1299709) % 1000) / 1000 - 0.5) * area;
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

function Building({ exploded, solarSelected, onSelectSolar }: Props) {
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

  const solarIds = pkg?.evaluation.upgradeIds.filter((id) => id.startsWith("rooftop_solar")) ?? [];
  const installedFraction = solarIds[0] ? (upgradeDef(solarIds[0]).constants["roofFraction"] ?? 1) : 0;
  const installed = solarSlotCount(layout.solarSlots.length, installedFraction);
  const preview = !installed && solarSelected;

  return (
    <group>
      <ZoneBox box={layout.podium.lobby} zone="lobby_common" color={colors.lobby_common} />
      <ZoneBox box={layout.podium.kitchen} zone="kitchen_restaurant" color={colors.kitchen_restaurant} />
      {layout.guestFloors.map((f, i) => (
        <ZoneBox key={i} box={{ ...f, y: f.y + i * gap }} zone="guest_rooms" color={colors.guest_rooms} opacity={exploded ? 0.82 : 1} />
      ))}
      <ZoneBox box={{ ...layout.core, y: layout.core.y + ((layout.floors - 1) * gap) / 2, h: layout.core.h + (layout.floors - 1) * gap }} zone="hallways_shared" color={colors.hallways_shared} />
      <Windows layout={layout} lift={lift} />
      {/* Roof slab, snow-covered in winter */}
      <mesh position={[0, top + 0.03, 0]} receiveShadow>
        <boxGeometry args={[layout.width + 0.1, 0.06, layout.depth + 0.1]} />
        <meshStandardMaterial color={scenery.snowCover ? "#eef3f8" : SCENE_COLORS.structure} />
      </mesh>
      <ZoneBox box={{ ...layout.plant, y: top + 0.4 }} zone="central_hvac" color={plantColor} />
      <Fan x={layout.plant.x} y={top + 0.83} z={layout.plant.z} speed={fanSpeed} />
      <ZoneBox box={layout.hotWater} zone="hot_water" color={colors.hot_water} />
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
      ? `Rooftop solar · ${hour.solar.sizeKw.toFixed(0)} kW · ${hour.solar.kW.toFixed(1)} kW now`
      : `Rooftop solar · not installed · potential ${hour.solar.previewKW.toFixed(1)} kW now (${hour.solar.previewSizeKw.toFixed(0)} kW array)`
    : `${ZONE_LABELS[zone!]} · ${usd(result.byZone[zone!].cost)} / yr`;
  return (
    <Html position={where} center distanceFactor={14} zIndexRange={[20, 0]}>
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
  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.fog, 28, 55]} />
      <ambientLight intensity={light.ambient} />
      <hemisphereLight args={[light.sky, scenery.ground, 0.25 + 0.35 * light.daylight]} />
      <directionalLight
        position={[sx * 30, sy * 30, sz * 30]}
        intensity={light.sunIntensity}
        color={light.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight position={[-sx * 20, 18, -sz * 20]} intensity={light.moonIntensity} color="#9fb6ff" />
      {light.stars && !reduce && <Stars radius={60} depth={20} count={1200} factor={2.5} fade speed={0} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color={scenery.ground} roughness={0.95} />
      </mesh>
      {/* A path to the entrance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-layout.width / 4, 0.01, layout.depth / 2 + 3]}>
        <planeGeometry args={[1.4, 5]} />
        <meshStandardMaterial color={scenery.snowCover ? "#c9d2dc" : "#8a8f99"} />
      </mesh>
      <Trees width={layout.width} depth={layout.depth} foliage={scenery.foliage} evergreen={scenery.evergreen} snow={scenery.snowCover} />
      {scenery.snowfall && !reduce && <Snowfall area={36} />}
    </>
  );
}

/** The canvas. `ref.resetCamera()` puts the camera back to the default isometric view. */
const HotelScene = forwardRef<HotelSceneHandle, Props>(function HotelScene(props, ref) {
  const controls = useRef<OrbitControlsImpl>(null);
  useImperativeHandle(ref, () => ({ resetCamera: () => controls.current?.reset() }), []);
  const rooms = useTwin((s) => s.hotel.profile.rooms);
  const floors = useTwin((s) => s.hotel.profile.floors);
  const layout = useMemo(() => buildingLayout(rooms, floors), [rooms, floors]);
  const span = Math.max(layout.width, layout.roofY * 1.4);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [span * 1.45, span * 0.95, span * 1.6], fov: 38, near: 0.1, far: 200 }}
      onPointerMissed={() => {
        useTwin.getState().selectZone(null);
        props.onSelectSolar(false);
      }}
      aria-label="3D hotel"
    >
      <Environment />
      <Building {...props} />
      <OrbitControls
        ref={controls}
        target={[-1.2, layout.roofY / 2, 0]}
        enableDamping
        minDistance={6}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.08}
      />
    </Canvas>
  );
});

export default HotelScene;
