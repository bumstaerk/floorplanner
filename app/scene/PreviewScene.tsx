import { useMemo } from "react";
import {
  OrbitControls,
  PerspectiveCamera,
  ContactShadows,
} from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useTimeOfDayStore } from "../store/useTimeOfDayStore";
import { useThemeColors } from "../hooks/useThemeColors";
import { FloorplanPlane } from "./FloorplanPlane";
import { Wall3D } from "./Wall3D";
import { Room3D } from "./Room3D";
import { FloorGroup3D } from "./FloorGroup3D";
import { DayNightLighting } from "./DayNightLighting";
import type { Floor } from "../store/types";

/**
 * A simple ground plane for the 3D preview so walls don't float in a void.
 */
function GroundPlane() {
  const colors = useThemeColors();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color={colors.groundPlane}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

/**
 * Visible grid in the 3D preview for spatial reference.
 */
function PreviewGrid() {
  const grid = useFloorplanStore((s) => s.grid);
  const colors = useThemeColors();

  if (!grid.visible) return null;

  return (
    <group position={[0, -0.005, 0]}>
      <gridHelper
        args={[grid.size, grid.divisions, colors.gridMajor, colors.gridMinor]}
      />
    </group>
  );
}

function FloorPlate3D({
  yOffset,
  width,
  depth,
  centerX,
  centerZ,
}: {
  yOffset: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
}) {
  const colors = useThemeColors();

  return (
    <mesh
      position={[centerX, yOffset, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      castShadow
    >
      <planeGeometry args={[width + 0.4, depth + 0.4]} />
      <meshStandardMaterial
        color={colors.floorPlate}
        roughness={0.9}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Compute the Y-offset for each floor based on cumulative floor heights.
 * Floors are sorted by level (ascending). Ground floor starts at Y=0.
 */
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

/**
 * The 3D preview scene.
 *
 * Renders all floors stacked vertically. Each floor's walls and rooms are
 * wrapped in a group with a Y-offset. Floor plates render between floors.
 */
export function PreviewScene() {
  const floors = useFloorplanStore(useShallow((s) => s.floors));
  const walls = useFloorplanStore(useShallow((s) => s.walls));
  const rooms = useFloorplanStore(useShallow((s) => s.rooms));
  const corners = useFloorplanStore(useShallow((s) => s.corners));
  const colors = useThemeColors();
  const dayNightEnabled = useTimeOfDayStore((s) => s.enabled);

  // Compute floor Y-offsets
  const floorOffsets = useMemo(() => computeFloorOffsets(floors), [floors]);

  // Group wall IDs and room IDs by floor
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

  // Compute bounding box across all corners for centering and camera
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

      // Total building height
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
      {/* Perspective camera positioned to encompass all floors */}
      <PerspectiveCamera
        makeDefault
        position={[
          centerX + extent * 0.6,
          totalHeight * 0.5 + extent * 0.4,
          centerZ + extent * 0.6,
        ]}
        fov={50}
        near={0.1}
        far={1000}
      />

      {/* Full orbit controls for 3D inspection */}
      <OrbitControls
        target={[centerX, totalHeight / 2, centerZ]}
        enableDamping
        dampingFactor={0.12}
        minDistance={1}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.1}
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
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[centerX + 15, totalHeight + 20, centerZ + 10]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            shadow-camera-near={0.5}
            shadow-camera-far={100}
          />
          <directionalLight
            position={[centerX - 10, totalHeight + 15, centerZ - 15]}
            intensity={0.3}
          />
          <hemisphereLight
            args={[colors.hemisphereTop, colors.hemisphereBottom, 0.3]}
          />
          <ContactShadows
            position={[centerX, 0, centerZ]}
            opacity={0.4}
            scale={50}
            blur={2}
            far={10}
          />
        </>
      )}

      {/* Ground and grid */}
      <GroundPlane />
      <PreviewGrid />

      {/* Floorplan image on the ground */}
      <FloorplanPlane />

      {/* Render each floor with Y-offset, wrapped in animated focus groups */}
      {sortedFloors.map((floor, i) => {
        const yOffset = floorOffsets.get(floor.id) ?? 0;
        const floorWallIds = wallsByFloor[floor.id] ?? [];
        const floorRoomIds = roomsByFloor[floor.id] ?? [];

        return (
          <FloorGroup3D
            key={floor.id}
            floor={floor}
            baseYOffset={yOffset}
            sortedFloors={sortedFloors}
          >
            {/* Floor plate (not for ground floor) */}
            {i > 0 && (
              <FloorPlate3D
                yOffset={0}
                width={bbWidth}
                depth={bbDepth}
                centerX={centerX}
                centerZ={centerZ}
              />
            )}

            {/* Room labels */}
            {floorRoomIds.map((id) => (
              <Room3D key={id} roomId={id} />
            ))}

            {/* Walls */}
            {floorWallIds.map((id) => (
              <Wall3D key={id} wallId={id} />
            ))}
          </FloorGroup3D>
        );
      })}

      {/* Fog — only when day/night cycle is off (DayNightLighting provides its own) */}
      {!dayNightEnabled && (
        <fog attach="fog" args={[colors.fog, 50, 200]} />
      )}
    </>
  );
}
