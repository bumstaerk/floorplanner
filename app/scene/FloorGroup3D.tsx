import { useRef, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  useSectionFocusStore,
  getFocusedFloorId,
} from "../store/useSectionFocusStore";
import type { Floor } from "../store/types";

interface FloorGroup3DProps {
  floor: Floor;
  /** Base Y offset for this floor (from cumulative floor heights) */
  baseYOffset: number;
  /** All floors sorted by level (ascending) for separation computation */
  sortedFloors: Floor[];
  children: React.ReactNode;
}

/** Gap (in meters) per level of separation when a floor is active */
const SEPARATION_GAP = 3;
/** Lerp factor for position animation (0–1, higher = faster) */
const POSITION_LERP = 0.08;

/**
 * Compute the target Y offset for a floor when another floor is active.
 * Floors above the active floor move up, floors below move down.
 * The active floor itself stays at its base position.
 */
function computeSeparatedY(
  floor: Floor,
  baseY: number,
  activeFloorId: string | null,
  sortedFloors: Floor[],
): number {
  if (!activeFloorId) return baseY;
  if (floor.id === activeFloorId) return baseY;

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId);
  if (!activeFloor) return baseY;

  const levelDiff = floor.level - activeFloor.level;
  return baseY + levelDiff * SEPARATION_GAP;
}

/**
 * Animated floor group wrapper for the 3D preview.
 *
 * Handles:
 * - Pointer enter/leave events for hover detection
 * - Click events for active section selection
 * - Smooth Y-position animation for exploded-view separation
 */
export function FloorGroup3D({
  floor,
  baseYOffset,
  sortedFloors,
  children,
}: FloorGroup3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { setHoveredFloor, setActiveFloor, activeFloorId } =
    useSectionFocusStore();

  // ── Pointer events ──────────────────────────────────────────────────────

  const onPointerEnter = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredFloor(floor.id);
    },
    [floor.id, setHoveredFloor],
  );

  const onPointerLeave = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredFloor(null);
    },
    [setHoveredFloor],
  );

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (activeFloorId === floor.id) return;
      setActiveFloor(floor.id);
    },
    [floor.id, activeFloorId, setActiveFloor],
  );

  // ── Position animation ──────────────────────────────────────────────────

  useFrame(() => {
    if (!groupRef.current) return;

    const state = useSectionFocusStore.getState();
    const targetY = computeSeparatedY(
      floor,
      baseYOffset,
      state.activeFloorId,
      sortedFloors,
    );

    const currentY = groupRef.current.position.y;
    if (Math.abs(currentY - targetY) > 0.001) {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        currentY,
        targetY,
        POSITION_LERP,
      );
    } else {
      groupRef.current.position.y = targetY;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, baseYOffset, 0]}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
    >
      {children}
    </group>
  );
}
