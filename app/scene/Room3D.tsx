import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useThemeColors } from "../hooks/useThemeColors";
import { useViewerTheme } from "../hooks/useViewerThemeColors";
import { RoomComponent3D } from "./RoomComponent3D";

interface Room3DProps {
  roomId: string;
}

/**
 * Renders a single detected room in 3D preview mode.
 *
 * Displays:
 * - A subtle filled polygon on the floor showing the room area
 * - The room name label at the centroid on the floor
 * - The room area in square meters below the name
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) → Three.js world (x, 0, z)
 *   The room polygon sits just above Y = 0 on the ground plane.
 */
export function Room3D({ roomId }: Room3DProps) {
  const room = useFloorplanStore((s) => s.rooms[roomId]);
  const corners = useFloorplanStore((s) => s.corners);
  const defaultWallHeight = useFloorplanStore((s) => s.defaultWallHeight);
  const colors = useThemeColors();
  const isViewer = useViewerTheme() !== null;

  // Build the filled room polygon geometry directly in XZ world-space.
  const fillGeo = useMemo(() => {
    if (!room) return null;

    const points = room.cornerIds
      .map((cid) => corners[cid]?.position)
      .filter((p): p is { x: number; y: number } => p != null);

    if (points.length < 3) return null;

    const Y = 0.005;

    // Use ShapeGeometry to triangulate the polygon
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();

    const shapeGeo = new THREE.ShapeGeometry(shape);

    // ShapeGeometry produces vertices in XY plane — remap to XZ
    const posAttr = shapeGeo.getAttribute("position");
    const positions = posAttr.array as Float32Array;
    for (let i = 0; i < posAttr.count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      positions[i * 3] = x; // X stays
      positions[i * 3 + 1] = Y; // Y = height above ground
      positions[i * 3 + 2] = y; // old Y becomes Z
    }
    posAttr.needsUpdate = true;
    shapeGeo.computeVertexNormals();
    shapeGeo.computeBoundingSphere();

    return shapeGeo;
  }, [room, corners]);

  if (!room || !fillGeo) return null;

  const { center, area, name } = room;
  const areaLabel = `${area.toFixed(1)} m²`;

  const Y = 0.005;

  return (
    <group>
      {/* Room floor surface */}
      <mesh geometry={fillGeo} receiveShadow>
        {isViewer ? (
          <meshStandardMaterial
            color={colors.room3dFill}
            side={THREE.DoubleSide}
            roughness={0.9}
            metalness={0}
          />
        ) : (
          <meshStandardMaterial
            color={colors.room3dFill}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        )}
      </mesh>

      {/* Room name label on the floor */}
      <Text
        position={[center.x, Y + 0.002, center.y]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.3}
        color={colors.room3dLabel}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor={colors.room3dOutline}
      >
        {name}
      </Text>

      {/* Area label below the name */}
      <Text
        position={[center.x, Y + 0.002, center.y + 0.45]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color={colors.room3dArea}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor={colors.room3dOutline}
      >
        {areaLabel}
      </Text>

      {/* Room ceiling components */}
      {room.components.map((comp) => (
        <RoomComponent3D
          key={comp.id}
          component={comp}
          ceilingHeight={defaultWallHeight}
          colors={colors}
          roomId={roomId}
        />
      ))}
    </group>
  );
}
