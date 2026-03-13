import { useMemo, useState, useCallback, useEffect } from "react";
import { Line, Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import type { Point2D } from "../store/types";

/**
 * Renders an interactive measuring ruler in the 2D build scene.
 *
 * Behavior:
 * - When the "measure" tool is active, the first left-click sets point A.
 * - Moving the mouse shows a live preview line from A to the cursor.
 * - A second left-click sets point B, completing the measurement.
 * - The completed measurement stays visible with its distance label.
 * - Clicking again after a completed measurement starts a new one.
 * - Right-click at any point cancels / clears the measurement.
 * - Switching away from the measure tool clears everything.
 *
 * The ruler displays:
 * - A solid line between A and B (dashed while previewing)
 * - Small perpendicular tick marks at each endpoint
 * - Endpoint dots
 * - A distance label (Html overlay) at the midpoint showing meters
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) -> Three.js world (x, 0, z)
 *   Rendered at Y = 0.02 (above walls and drawing lines).
 */

const Y = 0.02;
const TICK_SIZE = 0.12;

const RULER_COLOR_DONE = "#ef4444";
const RULER_COLOR_PREVIEW = "#f97316";

type MeasurePhase = "idle" | "placing" | "done";

export function MeasureLine() {
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const snapToGrid = useFloorplanStore((s) => s.snapToGrid);
  const { gl } = useThree();

  const [phase, setPhase] = useState<MeasurePhase>("idle");
  const [startPoint, setStartPoint] = useState<Point2D | null>(null);
  const [endPoint, setEndPoint] = useState<Point2D | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Point2D | null>(null);

  // Reset everything when switching away from the measure tool
  useEffect(() => {
    if (activeTool !== "measure") {
      setPhase("idle");
      setStartPoint(null);
      setEndPoint(null);
      setCursorPoint(null);
    }
  }, [activeTool]);

  // Right-click on the canvas clears the measurement
  useEffect(() => {
    if (activeTool !== "measure") return;

    const canvas = gl.domElement;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setPhase("idle");
      setStartPoint(null);
      setEndPoint(null);
      setCursorPoint(null);
    };

    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activeTool, gl]);

  // ── Pointer handlers for the invisible ground plane ──────────────────────

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (activeTool !== "measure") return;
      if (phase !== "placing") return;
      const raw: Point2D = { x: e.point.x, y: e.point.z };
      const snapped = snapToGrid(raw);
      setCursorPoint(snapped);
    },
    [activeTool, phase, snapToGrid],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (activeTool !== "measure") return;
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();

      const raw: Point2D = { x: e.point.x, y: e.point.z };
      const snapped = snapToGrid(raw);

      if (phase === "idle") {
        // First click — set start point
        setStartPoint(snapped);
        setCursorPoint(snapped);
        setEndPoint(null);
        setPhase("placing");
      } else if (phase === "placing") {
        // Second click — set end point, complete measurement
        setEndPoint(snapped);
        setCursorPoint(null);
        setPhase("done");
      } else if (phase === "done") {
        // Clicking after a completed measurement starts a new one
        setStartPoint(snapped);
        setCursorPoint(snapped);
        setEndPoint(null);
        setPhase("placing");
      }
    },
    [activeTool, phase, snapToGrid],
  );

  // ── Determine which two points to draw between ───────────────────────────

  const pointA = startPoint;
  const pointB = phase === "done" ? endPoint : cursorPoint;

  const lineData = useMemo(() => {
    if (!pointA || !pointB) return null;

    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.001) return null;

    const dirX = dx / length;
    const dirY = dy / length;
    // Perpendicular for tick marks
    const perpX = -dirY;
    const perpY = dirX;

    const mid: Point2D = {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    };

    return { start: pointA, end: pointB, length, mid, perpX, perpY };
  }, [pointA, pointB]);

  // Always render the invisible ground plane when measure tool is active
  // so clicks are captured. The visual ruler is only drawn when we have data.
  if (activeTool !== "measure") return null;

  const isDone = phase === "done";
  const color = isDone ? RULER_COLOR_DONE : RULER_COLOR_PREVIEW;

  return (
    <group>
      {/* Invisible ground plane for mouse interaction — sits just above the
          main GroundPlane so it intercepts pointer events first */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {lineData && (
        <>
          {/* Main ruler line */}
          <Line
            points={[
              [lineData.start.x, Y, lineData.start.y],
              [lineData.end.x, Y, lineData.end.y],
            ]}
            color={color}
            lineWidth={2.5}
            dashed={!isDone}
            dashSize={isDone ? undefined : 0.12}
            gapSize={isDone ? undefined : 0.06}
            depthTest={false}
          />

          {/* Start tick mark */}
          <Line
            points={[
              [
                lineData.start.x + lineData.perpX * TICK_SIZE,
                Y,
                lineData.start.y + lineData.perpY * TICK_SIZE,
              ],
              [
                lineData.start.x - lineData.perpX * TICK_SIZE,
                Y,
                lineData.start.y - lineData.perpY * TICK_SIZE,
              ],
            ]}
            color={color}
            lineWidth={2}
            depthTest={false}
          />

          {/* End tick mark */}
          <Line
            points={[
              [
                lineData.end.x + lineData.perpX * TICK_SIZE,
                Y,
                lineData.end.y + lineData.perpY * TICK_SIZE,
              ],
              [
                lineData.end.x - lineData.perpX * TICK_SIZE,
                Y,
                lineData.end.y - lineData.perpY * TICK_SIZE,
              ],
            ]}
            color={color}
            lineWidth={2}
            depthTest={false}
          />

          {/* Start point dot */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[lineData.start.x, Y + 0.002, lineData.start.y]}
          >
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial
              color={color}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>

          {/* End point dot */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[lineData.end.x, Y + 0.002, lineData.end.y]}
          >
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial
              color={color}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>

          {/* Distance label at midpoint */}
          {lineData.length > 0.05 && (
            <Html
              position={[lineData.mid.x, Y + 0.01, lineData.mid.y]}
              center
              style={{ pointerEvents: "none" }}
            >
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.82)",
                  color: "#ffffff",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  whiteSpace: "nowrap",
                  border: `1.5px solid ${color}`,
                  userSelect: "none",
                  lineHeight: "1.4",
                  letterSpacing: "0.02em",
                }}
              >
                📏 {lineData.length.toFixed(2)} m
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
