import { useMemo, useCallback } from "react";
import * as THREE from "three";
import { type ThreeEvent } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { computeWallGeometry } from "./wallGeometryUtils";
import { Opening2D } from "./Opening2D";

interface Wall2DProps {
    wallId: string;
}

/**
 * Renders a single wall segment in 2D build mode.
 *
 * Uses computeWallGeometry to get mitered corner points where walls connect,
 * so connected walls form clean corner joints instead of overlapping rectangles.
 *
 * The wall is drawn as a filled quad with an outline, plus labels for length
 * and dimensions. Color changes based on selection/hover state.
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) -> Three.js world (x, 0, z)
 *   All walls are rendered at Y = 0.01 (just above the ground plane).
 */
export function Wall2D({ wallId }: Wall2DProps) {
    const wall = useFloorplanStore((s) => s.walls[wallId]);
    const walls = useFloorplanStore((s) => s.walls);
    const corners = useFloorplanStore((s) => s.corners);
    const defaultWallThickness = useFloorplanStore(
        (s) => s.defaultWallThickness,
    );
    const defaultWallHeight = useFloorplanStore((s) => s.defaultWallHeight);
    const selectedWallId = useFloorplanStore((s) => s.selectedWallId);
    const hoveredWallId = useFloorplanStore((s) => s.hoveredWallId);
    const selectWall = useFloorplanStore((s) => s.selectWall);
    const setHoveredWall = useFloorplanStore((s) => s.setHoveredWall);
    const activeTool = useFloorplanStore((s) => s.activeTool);

    const isSelected = selectedWallId === wallId;
    const isHovered = hoveredWallId === wallId;
    const isInvisible = wall ? wall.visible === false : false;

    // Compute wall geometry with mitered corners
    const geometry = useMemo(() => {
        return computeWallGeometry(
            wallId,
            walls,
            corners,
            defaultWallThickness,
            defaultWallHeight,
        );
    }, [wallId, walls, corners, defaultWallThickness, defaultWallHeight]);

    // Build the filled wall shape geometry directly in XZ world-space.
    // Uses a BufferGeometry with two triangles forming a quad.
    const fillGeo = useMemo(() => {
        if (!geometry) return null;

        const Y = 0.01;
        const { leftStart, leftEnd, rightEnd, rightStart } = geometry.outline;

        const vertices = new Float32Array([
            // Triangle 1
            leftStart.x,
            Y,
            leftStart.y,
            leftEnd.x,
            Y,
            leftEnd.y,
            rightEnd.x,
            Y,
            rightEnd.y,
            // Triangle 2
            leftStart.x,
            Y,
            leftStart.y,
            rightEnd.x,
            Y,
            rightEnd.y,
            rightStart.x,
            Y,
            rightStart.y,
        ]);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();
        return geo;
    }, [geometry]);

    const handlePointerOver = useCallback(
        (e: ThreeEvent<PointerEvent>) => {
            if (activeTool !== "select") return;
            e.stopPropagation();
            setHoveredWall(wallId);
        },
        [activeTool, wallId, setHoveredWall],
    );

    const handlePointerOut = useCallback(
        (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHoveredWall(null);
        },
        [setHoveredWall],
    );

    const handleClick = useCallback(
        (e: ThreeEvent<MouseEvent>) => {
            if (activeTool !== "select") return;
            e.stopPropagation();
            selectWall(isSelected ? null : wallId);
        },
        [activeTool, wallId, isSelected, selectWall],
    );

    // ── All hooks are above this line ──────────────────────────────────────

    if (!geometry || !fillGeo) return null;

    const {
        outline,
        start,
        end,
        mid,
        length,
        angle,
        normX,
        normY,
        thickness,
        height,
    } = geometry;

    // Colors — invisible walls get a ghost-style dashed appearance
    const fillColor = isInvisible
        ? isSelected
            ? "#6366f1"
            : isHovered
              ? "#818cf8"
              : "#334155"
        : isSelected
          ? "#3b82f6"
          : isHovered
            ? "#60a5fa"
            : "#475569";
    const outlineColor = isInvisible
        ? isSelected
            ? "#6366f1"
            : isHovered
              ? "#818cf8"
              : "#475569"
        : isSelected
          ? "#1d4ed8"
          : isHovered
            ? "#3b82f6"
            : "#1e293b";
    const labelColor = isSelected ? "#ffffff" : "#e2e8f0";

    const Y = 0.01;

    const outlinePoints: [number, number, number][] = [
        [outline.leftStart.x, Y + 0.001, outline.leftStart.y],
        [outline.leftEnd.x, Y + 0.001, outline.leftEnd.y],
        [outline.rightEnd.x, Y + 0.001, outline.rightEnd.y],
        [outline.rightStart.x, Y + 0.001, outline.rightStart.y],
        [outline.leftStart.x, Y + 0.001, outline.leftStart.y],
    ];

    const centerLinePoints: [number, number, number][] = [
        [start.x, Y + 0.002, start.y],
        [end.x, Y + 0.002, end.y],
    ];

    const lengthLabel = `${length.toFixed(2)}m`;
    const labelOffset = thickness / 2 + 0.15;

    return (
        <group>
            {/* Filled wall body — raw BufferGeometry in world-space, no rotation needed */}
            <mesh
                geometry={fillGeo}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={handleClick}
            >
                <meshBasicMaterial
                    color={fillColor}
                    transparent
                    opacity={isInvisible ? 0.15 : 0.6}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Wall outline — dashed for invisible walls */}
            <Line
                points={outlinePoints}
                color={outlineColor}
                lineWidth={isInvisible ? 1.5 : 2}
                dashed={isInvisible}
                dashSize={isInvisible ? 0.1 : undefined}
                gapSize={isInvisible ? 0.06 : undefined}
                depthTest={false}
            />

            {/* Center line (dashed, only when selected) */}
            {isSelected && (
                <Line
                    points={centerLinePoints}
                    color="#94a3b8"
                    lineWidth={1}
                    dashed
                    dashSize={0.1}
                    gapSize={0.05}
                    depthTest={false}
                />
            )}

            {/* "Invisible" badge shown on the center of invisible walls */}
            {isInvisible && (
                <Text
                    position={[mid.x, Y + 0.004, mid.y]}
                    rotation={[-Math.PI / 2, 0, -angle]}
                    fontSize={0.07}
                    color="#a5b4fc"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.006}
                    outlineColor="#000000"
                >
                    invisible
                </Text>
            )}

            {/* Length label */}
            <Text
                position={[
                    mid.x + normX * labelOffset,
                    Y + 0.003,
                    mid.y + normY * labelOffset,
                ]}
                rotation={[-Math.PI / 2, 0, -angle]}
                fontSize={0.12}
                color={labelColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.01}
                outlineColor="#000000"
            >
                {lengthLabel}
            </Text>

            {/* Wall dimensions label (shown when selected) */}
            {isSelected && (
                <Text
                    position={[
                        mid.x - normX * labelOffset,
                        Y + 0.003,
                        mid.y - normY * labelOffset,
                    ]}
                    rotation={[-Math.PI / 2, 0, -angle]}
                    fontSize={0.09}
                    color={isInvisible ? "#a5b4fc" : "#93c5fd"}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.008}
                    outlineColor="#000000"
                >
                    {`${(thickness * 100).toFixed(0)}cm × ${(height * 100).toFixed(0)}cm`}
                </Text>
            )}

            {/* Openings (doors, windows, holes) rendered with standard 2D symbols — skip for invisible walls */}
            {wall &&
                !isInvisible &&
                wall.openings.map((opening) => (
                    <Opening2D
                        key={opening.id}
                        opening={opening}
                        wallStart={start}
                        wallEnd={end}
                        wallThickness={thickness}
                        wallLength={length}
                        isWallSelected={isSelected}
                    />
                ))}
        </group>
    );
}
