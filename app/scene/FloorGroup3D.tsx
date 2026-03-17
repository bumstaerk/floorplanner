import type { Floor } from "../store/types";

interface FloorGroup3DProps {
  floor: Floor;
  /** Base Y offset for this floor (from cumulative floor heights) */
  baseYOffset: number;
  /** All floors sorted by level (ascending) for separation computation */
  sortedFloors: Floor[];
  children: React.ReactNode;
}

export function FloorGroup3D({
  baseYOffset,
  children,
}: FloorGroup3DProps) {
  return (
    <group position={[0, baseYOffset, 0]}>
      {children}
    </group>
  );
}
