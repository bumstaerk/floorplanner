import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useFloorplanStore } from "../store/useFloorplanStore";

/**
 * Renders the in-progress wall line while the user is actively drawing.
 *
 * Shows a dashed line from the drawing start corner to the current cursor
 * position. Also shows a small indicator at the cursor with the projected
 * wall length.
 *
 * Only visible when `drawingFromCornerId` is set and `drawingCursor` is non-null.
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) -> Three.js world (x, 0, y)
 *   The line is rendered at Y = 0.015 (between walls and corners).
 */
export function DrawingLine() {
  const drawingFromCornerId = useFloorplanStore((s) => s.drawingFromCornerId);
  const drawingCursor = useFloorplanStore((s) => s.drawingCursor);
  const corners = useFloorplanStore((s) => s.corners);
  const snap = useFloorplanStore((s) => s.snap);

  const startCorner = drawingFromCornerId
    ? corners[drawingFromCornerId]
    : null;

  const lineData = useMemo(() => {
    if (!startCorner || !drawingCursor) return null;

    const start = startCorner.position;
    const end = drawingCursor;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.001) return null;

    // If angle snap is enabled, snap the cursor direction to the nearest angle multiple
    let snappedEnd = { ...end };
    if (snap.enabled && snap.angleSnap > 0) {
      const angle = Math.atan2(dy, dx);
      const snapRad = (snap.angleSnap * Math.PI) / 180;
      const snappedAngle = Math.round(angle / snapRad) * snapRad;
      snappedEnd = {
        x: start.x + Math.cos(snappedAngle) * length,
        y: start.y + Math.sin(snappedAngle) * length,
      };
    }

    // Snap to grid
    if (snap.enabled && snap.gridSize > 0) {
      snappedEnd = {
        x: Math.round(snappedEnd.x / snap.gridSize) * snap.gridSize,
        y: Math.round(snappedEnd.y / snap.gridSize) * snap.gridSize,
      };
    }

    const snappedDx = snappedEnd.x - start.x;
    const snappedDy = snappedEnd.y - start.y;
    const snappedLength = Math.sqrt(snappedDx * snappedDx + snappedDy * snappedDy);

    // Normal direction for label offset
    const dirX = snappedLength > 0 ? snappedDx / snappedLength : 0;
    const dirY = snappedLength > 0 ? snappedDy / snappedLength : 0;
    const normX = -dirY;
    const normY = dirX;
    const angle = Math.atan2(snappedDy, snappedDx);

    const mid = {
      x: (start.x + snappedEnd.x) / 2,
      y: (start.y + snappedEnd.y) / 2,
    };

    return {
      start,
      end: snappedEnd,
      length: snappedLength,
      mid,
      normX,
      normY,
      angle,
    };
  }, [startCorner, drawingCursor, snap]);

  if (!lineData) return null;

  const Y = 0.015;

  const linePoints: [number, number, number][] = [
    [lineData.start.x, Y, lineData.start.y],
    [lineData.end.x, Y, lineData.end.y],
  ];

  const labelText = `${lineData.length.toFixed(2)}m`;
  const labelOffset = 0.2;

  return (
    <group>
      {/* Main drawing line (dashed) */}
      <Line
        points={linePoints}
        color="#f59e0b"
        lineWidth={2}
        dashed
        dashSize={0.15}
        gapSize={0.08}
        depthTest={false}
      />

      {/* Cursor endpoint indicator */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[lineData.end.x, Y + 0.005, lineData.end.y]}
      >
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.8}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[lineData.end.x, Y + 0.005, lineData.end.y]}
      >
        <ringGeometry args={[0.06, 0.08, 16]} />
        <meshBasicMaterial
          color="#d97706"
          transparent
          opacity={1}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Length label at midpoint */}
      {lineData.length > 0.05 && (
        <group
          position={[
            lineData.mid.x + lineData.normX * labelOffset,
            Y + 0.003,
            lineData.mid.y + lineData.normY * labelOffset,
          ]}
        >
          {/* Background pill */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[labelText.length * 0.08 + 0.12, 0.18]} />
            <meshBasicMaterial
              color="#1e293b"
              transparent
              opacity={0.85}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
