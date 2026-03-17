import { useCallback, useRef, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { OrthographicCamera, MapControls } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useThemeColors } from "../hooks/useThemeColors";
import { FloorplanPlane } from "./FloorplanPlane";
import { Wall2D } from "./Wall2D";
import { Corner2D } from "./Corner2D";
import { Room2D } from "./Room2D";
import { DrawingLine } from "./DrawingLine";
import { MeasureLine } from "./MeasureLine";
import { CalibrateLine } from "./CalibrateLine";
import { Staircase2D } from "./Staircase2D";
import type { Point2D } from "../store/types";

/**
 * The 2D build-mode scene.
 *
 * Uses an orthographic camera looking straight down (top-down view).
 * MapControls allow panning and zooming but NOT rotation.
 *
 * Click behavior on the ground plane depends on the active tool:
 *   - "wall": clicks create/connect corners and draw wall segments between them.
 *   - "select": clicks on empty space deselect. Clicks on walls/corners select them.
 *   - "pan": clicks do nothing; the user just drags to pan.
 *
 * Coordinate mapping:
 *   The floorplan lives in the XZ plane (Y = 0).
 *   Orthographic camera looks down from Y = 100.
 *   Mouse raycasting hits the invisible ground plane at Y = 0.
 */

/** Invisible ground plane for raycasting mouse clicks in build mode */
function GroundPlane() {
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const snap = useFloorplanStore((s) => s.snap);
  const corners = useFloorplanStore((s) => s.corners);
  const drawingFromCornerId = useFloorplanStore((s) => s.drawingFromCornerId);

  const addCorner = useFloorplanStore((s) => s.addCorner);
  const startDrawing = useFloorplanStore((s) => s.startDrawing);
  const finishDrawing = useFloorplanStore((s) => s.finishDrawing);
  const cancelDrawing = useFloorplanStore((s) => s.cancelDrawing);
  const updateDrawingCursor = useFloorplanStore((s) => s.updateDrawingCursor);
  const selectWall = useFloorplanStore((s) => s.selectWall);
  const selectCorner = useFloorplanStore((s) => s.selectCorner);
  const pushHistory = useFloorplanStore((s) => s.pushHistory);
  const findSnapCorner = useFloorplanStore((s) => s.findSnapCorner);
  const snapToGrid = useFloorplanStore((s) => s.snapToGrid);
  const findWallAtPoint = useFloorplanStore((s) => s.findWallAtPoint);
  const splitWall = useFloorplanStore((s) => s.splitWall);
  const getWallsAtCorner = useFloorplanStore((s) => s.getWallsAtCorner);
  const addStaircaseOpening = useFloorplanStore((s) => s.addStaircaseOpening);

  /**
   * Given a 3D intersection point on the ground plane, return a snapped 2D point.
   * First checks if there's a nearby existing corner to snap to, then falls back to grid snap.
   */
  const resolvePoint = useCallback(
    (
      worldPoint: THREE.Vector3,
    ): { point: Point2D; existingCornerId: string | null } => {
      const raw: Point2D = { x: worldPoint.x, y: worldPoint.z };

      // Try snapping to an existing corner
      const snapCorner = findSnapCorner(raw);
      if (snapCorner) {
        return {
          point: snapCorner.position,
          existingCornerId: snapCorner.id,
        };
      }

      // Fall back to grid snap
      const snapped = snapToGrid(raw);
      return { point: snapped, existingCornerId: null };
    },
    [findSnapCorner, snapToGrid],
  );

  /**
   * Apply angle snapping: given a start point and a raw end point,
   * snap the direction to the nearest angle multiple.
   */
  const applyAngleSnap = useCallback(
    (start: Point2D, end: Point2D): Point2D => {
      if (!snap.enabled || snap.angleSnap <= 0) return end;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.001) return end;

      const angle = Math.atan2(dy, dx);
      const snapRad = (snap.angleSnap * Math.PI) / 180;
      const snappedAngle = Math.round(angle / snapRad) * snapRad;

      const snappedEnd = {
        x: start.x + Math.cos(snappedAngle) * length,
        y: start.y + Math.sin(snappedAngle) * length,
      };

      // Then grid-snap the result
      if (snap.enabled && snap.gridSize > 0) {
        snappedEnd.x = Math.round(snappedEnd.x / snap.gridSize) * snap.gridSize;
        snappedEnd.y = Math.round(snappedEnd.y / snap.gridSize) * snap.gridSize;
      }

      return snappedEnd;
    },
    [snap],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (activeTool !== "wall" || !drawingFromCornerId) return;

      const point = e.point;
      const raw: Point2D = { x: point.x, y: point.z };

      // Check if we're near an existing corner
      const snapCorner = findSnapCorner(raw);
      if (snapCorner) {
        updateDrawingCursor(snapCorner.position);
        return;
      }

      // Apply angle snap from the drawing start corner
      const startCorner = corners[drawingFromCornerId];
      if (startCorner) {
        const snapped = applyAngleSnap(startCorner.position, raw);
        updateDrawingCursor(snapped);
      } else {
        const snapped = snapToGrid(raw);
        updateDrawingCursor(snapped);
      }
    },
    [
      activeTool,
      drawingFromCornerId,
      corners,
      findSnapCorner,
      snapToGrid,
      applyAngleSnap,
      updateDrawingCursor,
    ],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // Only handle left click
      if (e.button !== undefined && e.button !== 0) return;

      if (activeTool === "select") {
        // Click on empty ground → deselect everything
        selectWall(null);
        selectCorner(null);
        return;
      }

      if (activeTool === "staircase") {
        e.stopPropagation();
        const raw: Point2D = { x: e.point.x, y: e.point.z };
        const snapped = snapToGrid(raw);
        pushHistory();
        addStaircaseOpening(snapped);
        return;
      }

      if (activeTool !== "wall") return;

      e.stopPropagation();

      const worldPoint = e.point;
      const { point, existingCornerId } = resolvePoint(worldPoint);

      if (drawingFromCornerId) {
        // We're currently drawing — finish the wall at this point

        // Apply angle snap relative to the start corner
        const startCorner = corners[drawingFromCornerId];
        let finalPoint = point;
        if (startCorner && !existingCornerId) {
          finalPoint = applyAngleSnap(startCorner.position, point);
        }

        let targetCornerId = existingCornerId;
        if (!targetCornerId) {
          // Check if clicking on an existing wall — split it to create a T-junction
          const wallHit = findWallAtPoint(finalPoint);
          if (wallHit) {
            // Don't split the wall we're currently drawing from
            const drawingFromWalls = getWallsAtCorner(drawingFromCornerId);
            if (!drawingFromWalls.includes(wallHit.wallId)) {
              // Snap the point to the wall's center line
              const snappedToWall = snapToGrid(wallHit.point);
              targetCornerId = splitWall(wallHit.wallId, snappedToWall);
            }
          }
          if (!targetCornerId) {
            // Create a new corner at the snapped position
            targetCornerId = addCorner(finalPoint);
          }
        }

        finishDrawing(targetCornerId);
      } else {
        // Not drawing yet — start a new wall

        let cornerId = existingCornerId;
        if (!cornerId) {
          // Check if clicking on an existing wall — split it
          const wallHit = findWallAtPoint(point);
          if (wallHit) {
            pushHistory();
            const snappedToWall = snapToGrid(wallHit.point);
            cornerId = splitWall(wallHit.wallId, snappedToWall);
          }
          if (!cornerId) {
            pushHistory();
            cornerId = addCorner(point);
          }
        }

        startDrawing(cornerId);
      }
    },
    [
      activeTool,
      drawingFromCornerId,
      corners,
      resolvePoint,
      applyAngleSnap,
      addCorner,
      startDrawing,
      finishDrawing,
      selectWall,
      selectCorner,
      pushHistory,
      findWallAtPoint,
      splitWall,
      getWallsAtCorner,
      snapToGrid,
      addStaircaseOpening,
    ],
  );

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      // Right-click cancels drawing
      if (drawingFromCornerId) {
        cancelDrawing();
      }
    },
    [drawingFromCornerId, cancelDrawing],
  );

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.001, 0]}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Visible grid lines on the ground */
function EditorGrid() {
  const gridVisible = useFloorplanStore((s) => s.grid.visible);
  const gridSize = useFloorplanStore((s) => s.grid.size);
  const gridDivisions = useFloorplanStore((s) => s.grid.divisions);
  const colors = useThemeColors();

  if (!gridVisible) return null;

  return (
    <group position={[0, -0.005, 0]}>
      <gridHelper
        args={[gridSize, gridDivisions, colors.gridMajor, colors.gridMinor]}
      />
    </group>
  );
}

/**
 * Keyboard event handler for build mode.
 *
 * Uses useEffect to attach a single keydown listener to the canvas element.
 * All store reads happen via getState() inside the event handler to avoid
 * subscribing to store changes (which would cause re-renders and potentially
 * infinite update loops).
 */
function BuildKeyboardHandler() {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    // Make canvas focusable so it can receive keyboard events
    canvas.tabIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useFloorplanStore.getState();

      // Escape: cancel drawing or deselect
      if (e.key === "Escape") {
        if (state.drawingFromCornerId) {
          state.cancelDrawing();
        } else {
          state.selectWall(null);
          state.selectCorner(null);
        }
        return;
      }

      // Delete / Backspace: remove selected wall, corner, or staircase
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedWallId) {
          state.pushHistory();
          state.removeWall(state.selectedWallId);
        } else if (state.selectedCornerId) {
          state.pushHistory();
          state.removeCorner(state.selectedCornerId);
        } else if (state.selectedStaircaseId) {
          state.pushHistory();
          state.removeStaircaseOpening(state.selectedStaircaseId);
        }
        return;
      }

      // Ctrl+Z: undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y: redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        state.redo();
        return;
      }

      // Arrow keys: move selected corner
      if (
        state.selectedCornerId &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        e.preventDefault();
        const corner = state.corners[state.selectedCornerId];
        if (!corner) return;
        const step = e.shiftKey ? 0.05 : 0.1;
        let { x, y } = corner.position;
        if (e.key === "ArrowUp") y -= step;
        if (e.key === "ArrowDown") y += step;
        if (e.key === "ArrowLeft") x -= step;
        if (e.key === "ArrowRight") x += step;
        state.pushHistory();
        state.moveCorner(state.selectedCornerId, { x, y });
        return;
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "v" || e.key === "V") {
          state.setActiveTool("select");
          return;
        }
        if (e.key === "w" || e.key === "W") {
          state.setActiveTool("wall");
          return;
        }
        if (e.key === "h" || e.key === "H") {
          state.setActiveTool("pan");
          return;
        }
        if (e.key === "m" || e.key === "M") {
          state.setActiveTool("measure");
          return;
        }
        if (e.key === "k" || e.key === "K") {
          state.setActiveTool("calibrate");
          return;
        }
        if (e.key === "s" || e.key === "S") {
          state.updateSnap({ enabled: !state.snap.enabled });
          return;
        }
        if (e.key === "g" || e.key === "G") {
          state.updateGrid({ visible: !state.grid.visible });
          return;
        }
      }
    };

    canvas.addEventListener("keydown", handleKeyDown);

    return () => {
      canvas.removeEventListener("keydown", handleKeyDown);
    };
  }, [gl]);

  return null;
}

export function BuildScene() {
  const currentFloorId = useFloorplanStore((s) => s.currentFloorId);
  const wallIds = useFloorplanStore(
    useShallow((s) =>
      Object.keys(s.walls).filter(
        (id) => s.walls[id].floorId === s.currentFloorId,
      ),
    ),
  );
  const cornerIds = useFloorplanStore(
    useShallow((s) =>
      Object.keys(s.corners).filter(
        (id) => s.corners[id].floorId === s.currentFloorId,
      ),
    ),
  );
  const roomIds = useFloorplanStore(
    useShallow((s) =>
      Object.keys(s.rooms).filter(
        (id) => s.rooms[id].floorId === s.currentFloorId,
      ),
    ),
  );
  const staircaseIds = useFloorplanStore(
    useShallow((s) =>
      Object.keys(s.staircaseOpenings).filter(
        (id) => s.staircaseOpenings[id].floorId === s.currentFloorId,
      ),
    ),
  );
  const activeTool = useFloorplanStore((s) => s.activeTool);

  return (
    <>
      {/* Top-down orthographic camera */}
      <OrthographicCamera
        makeDefault
        position={[0, 100, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={80}
        near={0.1}
        far={200}
      />

      {/* Pan/zoom controls — rotation disabled for 2D mode */}
      <MapControls
        enableRotate={false}
        enableDamping
        dampingFactor={0.15}
        screenSpacePanning
        minZoom={10}
        maxZoom={500}
        mouseButtons={{
          LEFT: activeTool === "pan" ? THREE.MOUSE.PAN : (undefined as any),
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: undefined as any,
        }}
      />

      {/* Ambient lighting for 2D mode */}
      <ambientLight intensity={1.5} />

      {/* Grid */}
      <EditorGrid />

      {/* Floorplan image background */}
      <FloorplanPlane />

      {/* Invisible ground plane for mouse interaction */}
      <GroundPlane />

      {/* Detected rooms (filled polygons with labels) */}
      {roomIds.map((id) => (
        <Room2D key={id} roomId={id} />
      ))}

      {/* Rendered walls (2D outlines with fill) */}
      {wallIds.map((id) => (
        <Wall2D key={id} wallId={id} />
      ))}

      {/* Rendered corners (circles at junctions) */}
      {cornerIds.map((id) => (
        <Corner2D key={id} cornerId={id} />
      ))}

      {/* Staircase openings */}
      {staircaseIds.map((id) => (
        <Staircase2D key={id} staircaseId={id} />
      ))}

      {/* In-progress drawing line */}
      <DrawingLine />

      {/* Measure tool ruler */}
      <MeasureLine />

      {/* Calibrate scale tool */}
      <CalibrateLine />

      {/* Keyboard handler */}
      <BuildKeyboardHandler />
    </>
  );
}
