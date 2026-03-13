import { useMemo, useCallback } from "react";
import * as THREE from "three";
import { type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useFloorplanStore } from "../store/useFloorplanStore";

interface Room2DProps {
    roomId: string;
}

/**
 * Renders a single detected room in 2D build mode.
 *
 * Displays:
 * - A filled polygon covering the room area (clickable for selection)
 * - The room name label at the centroid
 * - The room area in square meters below the name
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) → Three.js world (x, 0, z)
 *   The room polygon is rendered just above the ground plane at Y = 0.005.
 */
export function Room2D({ roomId }: Room2DProps) {
    const room = useFloorplanStore((s) => s.rooms[roomId]);
    const corners = useFloorplanStore((s) => s.corners);
    const selectedRoomId = useFloorplanStore((s) => s.selectedRoomId);
    const selectRoom = useFloorplanStore((s) => s.selectRoom);
    const activeTool = useFloorplanStore((s) => s.activeTool);

    const isSelected = selectedRoomId === roomId;

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

        // ShapeGeometry produces vertices in XY plane — we need to remap to XZ
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

    const handleClick = useCallback(
        (e: ThreeEvent<MouseEvent>) => {
            if (activeTool !== "select") return;
            e.stopPropagation();
            selectRoom(isSelected ? null : roomId);
        },
        [activeTool, roomId, isSelected, selectRoom],
    );

    if (!room || !fillGeo) return null;

    const { center, area, name } = room;
    const areaLabel = `${area.toFixed(1)} m²`;

    const fillColor = isSelected ? "#3b82f6" : "#334155";
    const fillOpacity = isSelected ? 0.25 : 0.1;
    const labelColor = isSelected ? "#93c5fd" : "#94a3b8";

    const Y = 0.005;

    return (
        <group>
            {/* Filled room polygon */}
            <mesh geometry={fillGeo} onClick={handleClick}>
                <meshBasicMaterial
                    color={fillColor}
                    transparent
                    opacity={fillOpacity}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Room name label */}
            <Text
                position={[center.x, Y + 0.004, center.y]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.18}
                color={labelColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.012}
                outlineColor="#000000"
                material-depthTest={false}
            >
                {name}
            </Text>

            {/* Area label below the name */}
            <Text
                position={[center.x, Y + 0.004, center.y + 0.28]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.12}
                color={labelColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.008}
                outlineColor="#000000"
                material-depthTest={false}
            >
                {areaLabel}
            </Text>
        </group>
    );
}
