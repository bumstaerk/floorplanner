import { useMemo } from "react";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useThemeColors } from "../hooks/useThemeColors";
import { useViewerTheme } from "../hooks/useViewerThemeColors";
import { computeWallGeometry } from "./wallGeometryUtils";
import type { WallOpening } from "../store/types";
import { Component3D } from "./Component3D";

interface Wall3DProps {
  wallId: string;
}

/**
 * Renders a single wall segment as a 3D mesh in preview mode.
 *
 * Uses computeWallGeometry to get mitered corner points, then builds the
 * wall mesh directly in world space (XZ plane) extruded upward along Y.
 * This ensures connected walls form clean corner joints in 3D.
 *
 * Windows get a transparent glass pane, doors get a frame outline,
 * and all openings are physically carved through the wall geometry.
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) → Three.js world (x, 0, z)
 *   Wall height extends along the Y axis from 0 to wall.height.
 */
export function Wall3D({ wallId }: Wall3DProps) {
  const wall = useFloorplanStore((s) => s.walls[wallId]);
  const walls = useFloorplanStore((s) => s.walls);
  const corners = useFloorplanStore((s) => s.corners);
  const defaultWallThickness = useFloorplanStore((s) => s.defaultWallThickness);
  const defaultWallHeight = useFloorplanStore((s) => s.defaultWallHeight);
  const selectedWallId = useFloorplanStore((s) => s.selectedWallId);

  const isSelected = selectedWallId === wallId;

  // ── Compute mitered wall geometry ──────────────────────────────────────────
  const computed = useMemo(() => {
    return computeWallGeometry(
      wallId,
      walls,
      corners,
      defaultWallThickness,
      defaultWallHeight,
    );
  }, [wallId, walls, corners, defaultWallThickness, defaultWallHeight]);

  // ── Build 3D wall geometry in world space ──────────────────────────────────
  //
  // The wall is built as a prism: the mitered quadrilateral base (in XZ)
  // extruded upward along Y from 0 to wall.height.
  //
  // For walls WITH openings, we use the old approach (local-space extrude
  // with rotation) because ExtrudeGeometry + Shape.holes is the cleanest
  // way to punch rectangular holes. The mitered corners still apply via
  // adjusting the local-space shape to match the mitered outline.
  //
  // For walls WITHOUT openings, we build a custom BufferGeometry prism
  // directly in world space from the 4 mitered corner points.

  const wallGeometry = useMemo(() => {
    if (!computed || !wall) return null;

    const { outline, height, length } = computed;
    const openings = wall.openings;

    if (openings.length === 0) {
      // ── No openings: build a direct world-space prism ────────────────
      return buildMiteredPrism(outline, height);
    }

    // ── With openings: build in local wall space, then transform ─────────
    // Local space: X runs along the wall center line, Y is height, Z is thickness.
    // We build a shape in XY with holes, extrude along Z, then position/rotate
    // into world space. For mitered corners, we adjust the local shape's
    // left/right edges to match the miter.

    // To do this properly, we project the mitered outline points into the
    // wall's local coordinate system.
    const { start, end, dirX, dirY, normX, normY, thickness } = computed;

    // Project a 2D world point onto the wall's local axes:
    //   localX = dot(point - start, dir)
    //   localZ = dot(point - start, norm)
    function toLocal(px: number, py: number): { lx: number; lz: number } {
      const dx = px - start.x;
      const dy = py - start.y;
      return {
        lx: dx * dirX + dy * dirY,
        lz: dx * normX + dy * normY,
      };
    }

    const lLS = toLocal(outline.leftStart.x, outline.leftStart.y);
    const lLE = toLocal(outline.leftEnd.x, outline.leftEnd.y);
    const lRS = toLocal(outline.rightStart.x, outline.rightStart.y);
    const lRE = toLocal(outline.rightEnd.x, outline.rightEnd.y);

    // The wall shape in local XY (X = along wall, Y = height).
    // Bottom edge goes from the right-start X to the right-end X (rightmost extent),
    // top edge follows the same. But the mitered shape is a trapezoid, not a rectangle.
    // We need to handle the fact that each end may be skewed.
    //
    // Strategy: build the shape as the full mitered quadrilateral at the base (Y=0),
    // then extrude upward. But ExtrudeGeometry extrudes a 2D shape along a single axis,
    // which doesn't directly support a trapezoidal cross-section.
    //
    // Better strategy: build the wall as a rectangular shape in local space
    // (same as before), extrude along Z for thickness, then warp the vertices
    // to match the mitered outline.
    //
    // Simplest correct approach: use the rectangular shape with openings punched,
    // extrude along Z, then transform the 4 corners of each end cap to match miter.

    const wallShape = new THREE.Shape();
    wallShape.moveTo(0, 0);
    wallShape.lineTo(length, 0);
    wallShape.lineTo(length, height);
    wallShape.lineTo(0, height);
    wallShape.closePath();

    const sortedOpenings = [...openings].sort((a, b) => a.offset - b.offset);

    for (const opening of sortedOpenings) {
      const holeLeft = opening.offset;
      const holeRight = holeLeft + opening.width;
      const holeBottom = opening.elevation;
      const holeTop = opening.elevation + opening.height;

      const clampedLeft = Math.max(0, holeLeft);
      const clampedRight = Math.min(length, holeRight);
      const clampedBottom = Math.max(0, holeBottom);
      const clampedTop = Math.min(height, holeTop);

      if (clampedRight <= clampedLeft || clampedTop <= clampedBottom) continue;

      const hole = new THREE.Path();
      hole.moveTo(clampedLeft, clampedBottom);
      hole.lineTo(clampedRight, clampedBottom);
      hole.lineTo(clampedRight, clampedTop);
      hole.lineTo(clampedLeft, clampedTop);
      hole.closePath();

      wallShape.holes.push(hole);
    }

    const geo = new THREE.ExtrudeGeometry(wallShape, {
      depth: thickness,
      bevelEnabled: false,
    });

    // Center the extrusion on Z
    geo.translate(0, 0, -thickness / 2);

    // Now warp the geometry so that the rectangular ends match the miter.
    // The geometry is in local space where:
    //   X = 0..length, Y = 0..height, Z = -thickness/2..thickness/2
    //
    // We need to transform each vertex back to world space, applying
    // the miter at the start (X near 0) and end (X near length) edges.
    //
    // For each vertex at local (lx, ly, lz):
    //   - Compute blend factor t = lx / length (0 at start, 1 at end)
    //   - Compute the mitered Z range at this t:
    //     At start: Z goes from lRS.lz to lLS.lz (right to left in local Z)
    //     At end:   Z goes from lRE.lz to lLE.lz
    //   - Remap the vertex Z from [-thickness/2, thickness/2] into the mitered range
    //   - Similarly adjust X for the miter skew

    const posAttr = geo.getAttribute("position");
    const positions = posAttr.array as Float32Array;
    const halfT = thickness / 2;

    for (let i = 0; i < posAttr.count; i++) {
      const lx = positions[i * 3];
      const ly = positions[i * 3 + 1];
      const lz = positions[i * 3 + 2];

      // Blend factor along the wall
      const t = Math.max(0, Math.min(1, lx / length));

      // Normalized Z position within the wall thickness (0 = right, 1 = left)
      const zNorm = (lz + halfT) / thickness;

      // Mitered local-X at start and end for this Z position
      const startLx = lRS.lx + (lLS.lx - lRS.lx) * zNorm;
      const endLx = lRE.lx + (lLE.lx - lRE.lx) * zNorm;

      // Mitered local-Z at start and end
      const startLz = lRS.lz + (lLS.lz - lRS.lz) * zNorm;
      const endLz = lRE.lz + (lLE.lz - lRE.lz) * zNorm;

      // Interpolated mitered position
      const miteredLx = startLx + (endLx - startLx) * t;
      const miteredLz = startLz + (endLz - startLz) * t;

      // Only warp the X and Z at the ends — blend smoothly
      // We want the miter effect only near the wall ends, not along the middle.
      // Actually, a linear interpolation along the full length IS correct for
      // a straight wall with mitered ends — the offset is linear.
      const newLx = miteredLx;
      const newLz = miteredLz;

      // Convert back to world space
      const worldX = start.x + newLx * dirX + newLz * normX;
      const worldZ = start.y + newLx * dirY + newLz * normY;

      positions[i * 3] = worldX;
      positions[i * 3 + 1] = ly; // Y (height) stays the same
      positions[i * 3 + 2] = worldZ;
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    return geo;
  }, [computed, wall]);

  // ── Glass panes for windows ────────────────────────────────────────────────
  const glassPanes = useMemo(() => {
    if (!computed || !wall) return [];

    const { start, dirX, dirY, normX, normY, length, height, thickness } =
      computed;
    const openings = wall.openings;

    return openings
      .filter((o) => o.type === "window")
      .map((opening) => {
        const holeLeft = opening.offset;
        const holeRight = holeLeft + opening.width;
        const holeBottom = opening.elevation;

        const clampedLeft = Math.max(0, holeLeft);
        const clampedRight = Math.min(length, holeRight);
        const clampedBottom = Math.max(0, holeBottom);
        const clampedTop = Math.min(height, opening.elevation + opening.height);

        const paneWidth = clampedRight - clampedLeft;
        const paneHeight = clampedTop - clampedBottom;

        if (paneWidth <= 0 || paneHeight <= 0) return null;

        // Center of the pane along the wall (in local X)
        const cx = (clampedLeft + clampedRight) / 2;
        const cy = (clampedBottom + clampedTop) / 2;

        // Convert local center to world position
        const worldX = start.x + cx * dirX;
        const worldZ = start.y + cx * dirY;

        // Rotation to align the pane perpendicular to the wall
        const angle = Math.atan2(dirY, dirX);

        return {
          id: opening.id,
          width: paneWidth,
          height: paneHeight,
          worldX,
          worldZ,
          cy,
          angle,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      width: number;
      height: number;
      worldX: number;
      worldZ: number;
      cy: number;
      angle: number;
    }>;
  }, [computed, wall]);

  // ── Door frames ────────────────────────────────────────────────────────────
  const doorFrames = useMemo(() => {
    if (!computed || !wall) return [];

    const { start, dirX, dirY, normX, normY, length, height, thickness } =
      computed;
    const openings = wall.openings;
    const halfT = thickness / 2;

    return openings
      .filter((o) => o.type === "door")
      .map((opening) => {
        const holeLeft = opening.offset;
        const holeRight = holeLeft + opening.width;
        const holeBottom = opening.elevation;
        const holeTop = opening.elevation + opening.height;

        const clampedLeft = Math.max(0, holeLeft);
        const clampedRight = Math.min(length, holeRight);
        const clampedBottom = Math.max(0, holeBottom);
        const clampedTop = Math.min(height, holeTop);

        // Convert local positions to world positions
        function toWorld(
          lx: number,
          ly: number,
          lz: number,
        ): [number, number, number] {
          return [
            start.x + lx * dirX + lz * normX,
            ly,
            start.y + lx * dirY + lz * normY,
          ];
        }

        const frontZ = halfT + 0.001;
        const backZ = -halfT - 0.001;

        const makeFacePoints = (z: number): [number, number, number][] => [
          toWorld(clampedLeft, clampedBottom, z),
          toWorld(clampedLeft, clampedTop, z),
          toWorld(clampedRight, clampedTop, z),
          toWorld(clampedRight, clampedBottom, z),
        ];

        return {
          id: opening.id,
          front: makeFacePoints(frontZ),
          back: makeFacePoints(backZ),
        };
      });
  }, [computed, wall]);

  // ── Window frames ──────────────────────────────────────────────────────────
  const windowFrames = useMemo(() => {
    if (!computed || !wall) return [];

    const { start, dirX, dirY, normX, normY, length, height, thickness } =
      computed;
    const openings = wall.openings;
    const halfT = thickness / 2;

    return openings
      .filter((o) => o.type === "window")
      .map((opening) => {
        const holeLeft = opening.offset;
        const holeRight = holeLeft + opening.width;
        const holeBottom = opening.elevation;
        const holeTop = opening.elevation + opening.height;

        const clampedLeft = Math.max(0, holeLeft);
        const clampedRight = Math.min(length, holeRight);
        const clampedBottom = Math.max(0, holeBottom);
        const clampedTop = Math.min(height, holeTop);

        const midX = (clampedLeft + clampedRight) / 2;
        const midY = (clampedBottom + clampedTop) / 2;

        function toWorld(
          lx: number,
          ly: number,
          lz: number,
        ): [number, number, number] {
          return [
            start.x + lx * dirX + lz * normX,
            ly,
            start.y + lx * dirY + lz * normY,
          ];
        }

        const frontZ = halfT + 0.001;
        const backZ = -halfT - 0.001;

        const makeFramePoints = (z: number): [number, number, number][] => [
          toWorld(clampedLeft, clampedBottom, z),
          toWorld(clampedLeft, clampedTop, z),
          toWorld(clampedRight, clampedTop, z),
          toWorld(clampedRight, clampedBottom, z),
          toWorld(clampedLeft, clampedBottom, z),
        ];

        const makeCrossV = (z: number): [number, number, number][] => [
          toWorld(midX, clampedBottom, z),
          toWorld(midX, clampedTop, z),
        ];

        const makeCrossH = (z: number): [number, number, number][] => [
          toWorld(clampedLeft, midY, z),
          toWorld(clampedRight, midY, z),
        ];

        return {
          id: opening.id,
          frontFrame: makeFramePoints(frontZ),
          backFrame: makeFramePoints(backZ),
          frontCrossV: makeCrossV(frontZ),
          backCrossV: makeCrossV(backZ),
          frontCrossH: makeCrossH(frontZ),
          backCrossH: makeCrossH(backZ),
        };
      });
  }, [computed, wall]);

  // ── All hooks above this line ──────────────────────────────────────────────

  const colors = useThemeColors();
  const isViewer = useViewerTheme() !== null;

  // Invisible walls are not rendered in 3D — they only act as room dividers
  if (!wall || wall.visible === false) return null;

  if (!computed || !wallGeometry) return null;

  return (
    <group>
      {/* Main wall mesh — already in world space */}
      <mesh geometry={wallGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={isSelected ? colors.wall3dSelected : colors.wall3dDefault}
          roughness={0.92}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe overlay for selected walls (hidden in viewer) */}
      {!isViewer && isSelected && (
        <mesh geometry={wallGeometry}>
          <meshBasicMaterial
            color={colors.wall3dWireframe}
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}

      {/* Edge outline for visual definition (hidden in viewer) */}
      {!isViewer && (
        <lineSegments>
          <edgesGeometry args={[wallGeometry, 15]} />
          <lineBasicMaterial
            color={colors.wall3dEdge}
            transparent
            opacity={0.4}
          />
        </lineSegments>
      )}

      {/* ── Glass panes for windows ──────────────────────────────────────── */}
      {glassPanes.map((pane) => (
        <mesh
          key={pane.id}
          position={[pane.worldX, pane.cy, pane.worldZ]}
          rotation={[0, -pane.angle, 0]}
          renderOrder={1}
        >
          <planeGeometry args={[pane.width, pane.height]} />
          <meshPhysicalMaterial
            color={colors.wall3dGlass}
            transparent
            opacity={0.18}
            roughness={0.05}
            metalness={0.1}
            transmission={0.85}
            thickness={0.02}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Window frames ────────────────────────────────────────────────── */}
      {windowFrames.map((frame) => (
        <group key={frame.id}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.frontFrame.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.backFrame.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.frontCrossV.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.frontCrossH.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.backCrossV.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.backCrossH.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dWindowFrame} linewidth={1} />
          </line>
        </group>
      ))}

      {/* ── Door frames ──────────────────────────────────────────────────── */}
      {doorFrames.map((frame) => (
        <group key={frame.id}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.front.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dDoorFrame} linewidth={1} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(frame.back.flat()), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={colors.wall3dDoorFrame} linewidth={1} />
          </line>
        </group>
      ))}

      {/* ── Wall components (lights, sensors, outlets, switches) ──────── */}
      {wall.components.map((comp) => (
        <Component3D
          key={comp.id}
          component={comp}
          geometry={computed}
          colors={colors}
          wallId={wallId}
        />
      ))}
    </group>
  );
}

// ─── Helper: build a prism from the mitered outline (no openings case) ───────

function buildMiteredPrism(
  outline: {
    leftStart: { x: number; y: number };
    leftEnd: { x: number; y: number };
    rightStart: { x: number; y: number };
    rightEnd: { x: number; y: number };
  },
  height: number,
): THREE.BufferGeometry {
  const { leftStart: ls, leftEnd: le, rightStart: rs, rightEnd: re } = outline;

  // 8 vertices of the prism (4 bottom at Y=0, 4 top at Y=height)
  //
  //   Top:    TLS ─── TLE
  //            │       │
  //           TRS ─── TRE
  //
  //   Bottom: BLS ─── BLE
  //            │       │
  //           BRS ─── BRE

  // prettier-ignore
  const verts = {
        BLS: [ls.x, 0,      ls.y] as const,
        BLE: [le.x, 0,      le.y] as const,
        BRS: [rs.x, 0,      rs.y] as const,
        BRE: [re.x, 0,      re.y] as const,
        TLS: [ls.x, height, ls.y] as const,
        TLE: [le.x, height, le.y] as const,
        TRS: [rs.x, height, rs.y] as const,
        TRE: [re.x, height, re.y] as const,
    };

  // 6 faces × 2 triangles × 3 vertices × 3 components = 108 floats
  // Faces: front (left side), back (right side), top, bottom, start cap, end cap

  const positions: number[] = [];

  function pushTri(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ) {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  // Left face (LS → LE, looking from outside = +normal direction)
  pushTri(verts.BLS, verts.BLE, verts.TLE);
  pushTri(verts.BLS, verts.TLE, verts.TLS);

  // Right face (RS → RE, looking from outside = −normal direction)
  pushTri(verts.BRE, verts.BRS, verts.TRS);
  pushTri(verts.BRE, verts.TRS, verts.TRE);

  // Top face (Y = height)
  pushTri(verts.TLS, verts.TLE, verts.TRE);
  pushTri(verts.TLS, verts.TRE, verts.TRS);

  // Bottom face (Y = 0)
  pushTri(verts.BLS, verts.BRS, verts.BRE);
  pushTri(verts.BLS, verts.BRE, verts.BLE);

  // Start cap (LS ↔ RS at the start end)
  pushTri(verts.BRS, verts.BLS, verts.TLS);
  pushTri(verts.BRS, verts.TLS, verts.TRS);

  // End cap (LE ↔ RE at the end)
  pushTri(verts.BLE, verts.BRE, verts.TRE);
  pushTri(verts.BLE, verts.TRE, verts.TLE);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geo.computeVertexNormals();

  return geo;
}
