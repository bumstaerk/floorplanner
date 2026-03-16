import { useMemo } from "react";
import {
  OrbitControls,
  PerspectiveCamera,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import { Wall3D } from "./Wall3D";
import { Room3D } from "./Room3D";
import { DayNightLighting } from "./DayNightLighting";
import { useTimeOfDayStore } from "../store/useTimeOfDayStore";
import type {
  CornerNode,
  WallSegment,
  Room,
  Floor,
  ModelTheme,
} from "../store/types";

interface ViewerSceneProps {
  floors: Floor[];
  walls: Record<string, WallSegment>;
  rooms: Record<string, Room>;
  corners: Record<string, CornerNode>;
  theme: ModelTheme;
}

function computeFloorOffsets(floors: Floor[]): Map<string, number> {
  const sorted = [...floors].sort((a, b) => a.level - b.level);
  const offsets = new Map<string, number>();
  let y = 0;
  for (let i = 0; i < sorted.length; i++) {
    offsets.set(sorted[i].id, y);
    y += sorted[i].floorHeight;
  }
  return offsets;
}

function GroundPlane({ color, centerX = 0, centerZ = 0 }: { color: string; centerX?: number; centerZ?: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[centerX, -0.005, centerZ]}
      receiveShadow
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  );
}

function FloorPlate3D({
  yOffset,
  width,
  depth,
  centerX,
  centerZ,
  color,
}: {
  yOffset: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
  color: string;
}) {
  return (
    <mesh
      position={[centerX, yOffset, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      castShadow
    >
      <planeGeometry args={[width + 0.4, depth + 0.4]} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * A polished, production-ready 3D scene for the /plan/:id viewer page.
 *
 * Differences from PreviewScene:
 * - No grid, no floorplan image overlay, no selection highlighting
 * - Softer, more cinematic lighting with environment map
 * - Uses the plan's ModelTheme for all colours
 * - Smoother orbit controls with auto-rotate
 */
export function ViewerScene({
  floors,
  walls,
  rooms,
  corners,
  theme,
}: ViewerSceneProps) {
  const dayNightEnabled = useTimeOfDayStore((s) => s.enabled);
  const floorOffsets = useMemo(() => computeFloorOffsets(floors), [floors]);

  const wallsByFloor = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const f of floors) map[f.id] = [];
    for (const [id, w] of Object.entries(walls)) {
      if (map[w.floorId]) map[w.floorId].push(id);
    }
    return map;
  }, [walls, floors]);

  const roomsByFloor = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const f of floors) map[f.id] = [];
    for (const [id, r] of Object.entries(rooms)) {
      if (map[r.floorId]) map[r.floorId].push(id);
    }
    return map;
  }, [rooms, floors]);

  const { centerX, centerZ, extent, totalHeight, bbWidth, bbDepth } =
    useMemo(() => {
      const cornerList = Object.values(corners);
      let cx = 0,
        cz = 0,
        ext = 10,
        bw = 10,
        bd = 10;

      if (cornerList.length > 0) {
        let minX = Infinity,
          maxX = -Infinity;
        let minZ = Infinity,
          maxZ = -Infinity;
        for (const c of cornerList) {
          minX = Math.min(minX, c.position.x);
          maxX = Math.max(maxX, c.position.x);
          minZ = Math.min(minZ, c.position.y);
          maxZ = Math.max(maxZ, c.position.y);
        }
        cx = (minX + maxX) / 2;
        cz = (minZ + maxZ) / 2;
        bw = maxX - minX;
        bd = maxZ - minZ;

        if (cornerList.length >= 2) {
          let maxDist = 0;
          for (const c of cornerList) {
            const dx = c.position.x - cx;
            const dz = c.position.y - cz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > maxDist) maxDist = dist;
          }
          ext = Math.max(5, maxDist * 2.5);
        }
      }

      let th = 0;
      for (const f of floors) th += f.floorHeight;

      return {
        centerX: cx,
        centerZ: cz,
        extent: Math.max(ext, th * 1.5),
        totalHeight: th,
        bbWidth: bw,
        bbDepth: bd,
      };
    }, [corners, floors]);

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.level - b.level),
    [floors],
  );

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera
        makeDefault
        position={[
          centerX + extent * 0.7,
          totalHeight * 0.5 + extent * 0.5,
          centerZ + extent * 0.7,
        ]}
        fov={40}
        near={0.1}
        far={1000}
      />

      {/* Smooth orbit with auto-rotate */}
      <OrbitControls
        target={[centerX, totalHeight / 2, centerZ]}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.1}
        autoRotate
        autoRotateSpeed={0.3}
      />

      {/* Lighting — day/night cycle or static */}
      {dayNightEnabled ? (
        <DayNightLighting
          centerX={centerX}
          centerZ={centerZ}
          totalHeight={totalHeight}
          extent={extent}
        />
      ) : (
        <>
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[centerX + 20, totalHeight + 25, centerZ + 15]}
            intensity={0.7}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            shadow-camera-near={0.5}
            shadow-camera-far={100}
            shadow-bias={-0.0001}
          />
          <directionalLight
            position={[centerX - 15, totalHeight + 10, centerZ - 20]}
            intensity={0.2}
          />
          <directionalLight
            position={[centerX, totalHeight + 5, centerZ - extent]}
            intensity={0.1}
          />
          <hemisphereLight args={["#dde4f0", "#b8a080", 0.25]} />
          <ContactShadows
            position={[centerX, 0.001, centerZ]}
            opacity={0.6}
            scale={60}
            blur={1.0}
            far={4}
          />
        </>
      )}

      {/* Subtle environment for reflections only */}
      <Environment preset="studio" background={false} environmentIntensity={0.15} />

      {/* Ground */}
      <GroundPlane color={theme.groundColor} centerX={centerX} centerZ={centerZ} />

      {/* Render floors */}
      {sortedFloors.map((floor, i) => {
        const yOffset = floorOffsets.get(floor.id) ?? 0;
        const floorWallIds = wallsByFloor[floor.id] ?? [];
        const floorRoomIds = roomsByFloor[floor.id] ?? [];

        return (
          <group key={floor.id} position={[0, yOffset, 0]}>
            {i > 0 && (
              <FloorPlate3D
                yOffset={0}
                width={bbWidth}
                depth={bbDepth}
                centerX={centerX}
                centerZ={centerZ}
                color={theme.floorPlateColor}
              />
            )}

            {floorRoomIds.map((id) => (
              <Room3D key={id} roomId={id} />
            ))}

            {floorWallIds.map((id) => (
              <Wall3D key={id} wallId={id} />
            ))}
          </group>
        );
      })}

      {/* Fog — only when day/night cycle is off */}
      {!dayNightEnabled && (
        <fog attach="fog" args={[theme.backgroundColor, 60, 250]} />
      )}
    </>
  );
}
