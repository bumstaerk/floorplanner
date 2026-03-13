import { useCallback } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useThemeColors } from "../hooks/useThemeColors";

interface Corner2DProps {
  cornerId: string;
}

/**
 * Renders a single corner node in 2D build mode as a small circle/ring.
 *
 * Behavior depends on the active tool:
 * - "select": click to select, drag to move the corner
 * - "wall": click to start/continue/finish drawing a wall from this corner
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) -> Three.js world (x, 0, y)
 *   Corners are rendered at Y = 0.02 (above walls and ground plane).
 */
export function Corner2D({ cornerId }: Corner2DProps) {
  const corner = useFloorplanStore((s) => s.corners[cornerId]);
  const selectedCornerId = useFloorplanStore((s) => s.selectedCornerId);
  const hoveredCornerId = useFloorplanStore((s) => s.hoveredCornerId);
  const drawingFromCornerId = useFloorplanStore((s) => s.drawingFromCornerId);
  const activeTool = useFloorplanStore((s) => s.activeTool);

  const selectCorner = useFloorplanStore((s) => s.selectCorner);
  const setHoveredCorner = useFloorplanStore((s) => s.setHoveredCorner);
  const startDrawing = useFloorplanStore((s) => s.startDrawing);
  const finishDrawing = useFloorplanStore((s) => s.finishDrawing);

  const isSelected = selectedCornerId === cornerId;
  const isHovered = hoveredCornerId === cornerId;
  const isDrawingFrom = drawingFromCornerId === cornerId;

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredCorner(cornerId);
      document.body.style.cursor =
        activeTool === "wall" ? "crosshair" : "pointer";
    },
    [cornerId, setHoveredCorner, activeTool],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredCorner(null);
      document.body.style.cursor = "default";
    },
    [setHoveredCorner],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();

      if (activeTool === "wall") {
        if (drawingFromCornerId) {
          // Finish drawing: connect from the current drawing start to this corner
          finishDrawing(cornerId);
        } else {
          // Start drawing from this corner
          startDrawing(cornerId);
        }
        return;
      }

      if (activeTool === "select") {
        selectCorner(isSelected ? null : cornerId);
      }
    },
    [
      activeTool,
      cornerId,
      drawingFromCornerId,
      isSelected,
      selectCorner,
      startDrawing,
      finishDrawing,
    ],
  );

  if (!corner) return null;

  const colors = useThemeColors();

  // Determine visual state
  const radius = isHovered || isSelected || isDrawingFrom ? 0.12 : 0.08;
  const color = isDrawingFrom
    ? colors.cornerDrawing
    : isSelected
      ? colors.cornerSelected
      : isHovered
        ? colors.cornerHovered
        : colors.cornerDefault;

  const ringColor = isDrawingFrom
    ? colors.cornerRingDrawing
    : isSelected
      ? colors.cornerRingSelected
      : isHovered
        ? colors.cornerRingHovered
        : colors.cornerRingDefault;

  const Y = 0.02; // Above walls

  return (
    <group position={[corner.position.x, Y, corner.position.y]}>
      {/* Filled circle */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[radius, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + 0.02, 24]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={1}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Active drawing indicator - pulsing ring */}
      {isDrawingFrom && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.04, radius + 0.06, 24]} />
          <meshBasicMaterial
            color={colors.cornerDrawingPulse}
            transparent
            opacity={0.5}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}
