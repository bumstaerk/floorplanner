import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Line, Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import type { Point2D } from "../store/types";

/**
 * Reference line calibration tool.
 *
 * Behavior:
 * - When the "calibrate" tool is active, first left-click sets point A.
 * - Moving the mouse shows a live dashed preview line.
 * - A second left-click sets point B and opens an input asking for the
 *   real-world distance between the two points.
 * - Confirming the distance calls calibrateScale(), rescaling the floorplan
 *   image and all drawn corners proportionally.
 * - Right-click cancels at any phase.
 *
 * Color: blue (#3b82f6) to distinguish from the red measure tool.
 */

const Y = 0.021; // just above MeasureLine (0.02)
const TICK_SIZE = 0.12;
const COLOR = "#3b82f6";

type Phase = "idle" | "placing" | "done";

export function CalibrateLine() {
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const setActiveTool = useFloorplanStore((s) => s.setActiveTool);
  const snapToGrid = useFloorplanStore((s) => s.snapToGrid);
  const calibrateScale = useFloorplanStore((s) => s.calibrateScale);
  const { gl } = useThree();

  const [phase, setPhase] = useState<Phase>("idle");
  const [startPoint, setStartPoint] = useState<Point2D | null>(null);
  const [endPoint, setEndPoint] = useState<Point2D | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Point2D | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when switching away from the calibrate tool
  useEffect(() => {
    if (activeTool !== "calibrate") {
      setPhase("idle");
      setStartPoint(null);
      setEndPoint(null);
      setCursorPoint(null);
      setInputValue("");
      setInputError("");
    }
  }, [activeTool]);

  // Focus the input when we enter the "done" phase
  useEffect(() => {
    if (phase === "done") {
      setInputValue("");
      setInputError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

  // Right-click cancels
  useEffect(() => {
    if (activeTool !== "calibrate") return;
    const canvas = gl.domElement;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setPhase("idle");
      setStartPoint(null);
      setEndPoint(null);
      setCursorPoint(null);
    };
    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => canvas.removeEventListener("contextmenu", handleContextMenu);
  }, [activeTool, gl]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (activeTool !== "calibrate" || phase !== "placing") return;
      const raw: Point2D = { x: e.point.x, y: e.point.z };
      setCursorPoint(snapToGrid(raw));
    },
    [activeTool, phase, snapToGrid],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (activeTool !== "calibrate") return;
      if (e.button !== undefined && e.button !== 0) return;
      // Don't start a new measurement while the input dialog is open
      if (phase === "done") return;
      e.stopPropagation();

      const raw: Point2D = { x: e.point.x, y: e.point.z };
      const snapped = snapToGrid(raw);

      if (phase === "idle") {
        setStartPoint(snapped);
        setCursorPoint(snapped);
        setEndPoint(null);
        setPhase("placing");
      } else if (phase === "placing") {
        setEndPoint(snapped);
        setCursorPoint(null);
        setPhase("done");
      }
    },
    [activeTool, phase, snapToGrid],
  );

  const handleApply = useCallback(() => {
    const parsed = parseFloat(inputValue.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setInputError("Enter a positive number in meters.");
      return;
    }
    if (!startPoint || !endPoint) return;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const refLength = Math.sqrt(dx * dx + dy * dy);
    if (refLength < 0.001) {
      setInputError("Line is too short.");
      return;
    }
    calibrateScale(refLength, parsed);
    setActiveTool("select");
  }, [inputValue, startPoint, endPoint, calibrateScale, setActiveTool]);

  const handleCancel = useCallback(() => {
    setPhase("idle");
    setStartPoint(null);
    setEndPoint(null);
    setCursorPoint(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleApply();
      if (e.key === "Escape") handleCancel();
    },
    [handleApply, handleCancel],
  );

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
    const perpX = -dirY;
    const perpY = dirX;
    const mid: Point2D = {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    };
    return { start: pointA, end: pointB, length, mid, perpX, perpY };
  }, [pointA, pointB]);

  if (activeTool !== "calibrate") return null;

  const isDone = phase === "done";

  return (
    <group>
      {/* Invisible ground plane to capture pointer events */}
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
          {/* Main line */}
          <Line
            points={[
              [lineData.start.x, Y, lineData.start.y],
              [lineData.end.x, Y, lineData.end.y],
            ]}
            color={COLOR}
            lineWidth={2.5}
            dashed={!isDone}
            dashSize={isDone ? undefined : 0.12}
            gapSize={isDone ? undefined : 0.06}
            depthTest={false}
          />

          {/* Start tick */}
          <Line
            points={[
              [lineData.start.x + lineData.perpX * TICK_SIZE, Y, lineData.start.y + lineData.perpY * TICK_SIZE],
              [lineData.start.x - lineData.perpX * TICK_SIZE, Y, lineData.start.y - lineData.perpY * TICK_SIZE],
            ]}
            color={COLOR}
            lineWidth={2}
            depthTest={false}
          />

          {/* End tick */}
          <Line
            points={[
              [lineData.end.x + lineData.perpX * TICK_SIZE, Y, lineData.end.y + lineData.perpY * TICK_SIZE],
              [lineData.end.x - lineData.perpX * TICK_SIZE, Y, lineData.end.y - lineData.perpY * TICK_SIZE],
            ]}
            color={COLOR}
            lineWidth={2}
            depthTest={false}
          />

          {/* Start dot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lineData.start.x, Y + 0.002, lineData.start.y]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color={COLOR} depthWrite={false} depthTest={false} />
          </mesh>

          {/* End dot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lineData.end.x, Y + 0.002, lineData.end.y]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color={COLOR} depthWrite={false} depthTest={false} />
          </mesh>

          {/* Label / input at midpoint */}
          {lineData.length > 0.05 && (
            <Html position={[lineData.mid.x, Y + 0.01, lineData.mid.y]} center style={{ pointerEvents: isDone ? "auto" : "none" }}>
              {isDone ? (
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.95)",
                    border: `1.5px solid ${COLOR}`,
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "220px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                >
                  <div style={{ color: "#93c5fd", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Set Real-World Distance
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: "12px" }}>
                    Line: {lineData.length.toFixed(2)} m (current scale)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      ref={inputRef}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 4.5"
                      value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); setInputError(""); }}
                      onKeyDown={handleKeyDown}
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.08)",
                        border: `1px solid ${inputError ? "#ef4444" : "#334155"}`,
                        borderRadius: "4px",
                        color: "#f1f5f9",
                        padding: "5px 8px",
                        fontSize: "13px",
                        outline: "none",
                        width: "90px",
                      }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>m</span>
                  </div>
                  {inputError && (
                    <div style={{ color: "#ef4444", fontSize: "11px" }}>{inputError}</div>
                  )}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={handleApply}
                      style={{
                        flex: 1,
                        background: COLOR,
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "5px 0",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.08)",
                        color: "#94a3b8",
                        border: "1px solid #334155",
                        borderRadius: "4px",
                        padding: "5px 0",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
                    border: `1.5px solid ${COLOR}`,
                    userSelect: "none",
                    lineHeight: "1.4",
                    letterSpacing: "0.02em",
                  }}
                >
                  {lineData.length.toFixed(2)} m
                </div>
              )}
            </Html>
          )}
        </>
      )}
    </group>
  );
}
