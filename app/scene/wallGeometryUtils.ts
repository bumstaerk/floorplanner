import type { Point2D, WallSegment, CornerNode } from "../store/types";

// ─── Types ──────────────────────────────────────────────────────────────────────

/**
 * The computed 2D outline of a single wall segment, with mitered corners
 * where it connects to other walls at shared corner nodes.
 *
 * The four points form a quadrilateral in 2D floorplan space:
 *
 *   leftStart ─────────────────── leftEnd
 *       │                            │
 *   (start corner)            (end corner)
 *       │                            │
 *   rightStart ────────────────── rightEnd
 *
 * "Left" and "Right" are relative to the wall direction (start → end),
 * where Left is in the +normal direction and Right is in the −normal direction.
 */
export interface WallOutline {
    leftStart: Point2D;
    leftEnd: Point2D;
    rightStart: Point2D;
    rightEnd: Point2D;
}

/**
 * Full computed geometry for a wall segment including the outline,
 * center line, and metadata used by both 2D and 3D renderers.
 */
export interface ComputedWallGeometry {
    /** The mitered 2D outline points */
    outline: WallOutline;
    /** Start corner center position */
    start: Point2D;
    /** End corner center position */
    end: Point2D;
    /** Midpoint of the center line */
    mid: Point2D;
    /** Wall length along the center line (meters) */
    length: number;
    /** Angle of the wall in radians (atan2 of direction) */
    angle: number;
    /** Unit normal pointing in the "left" direction */
    normX: number;
    normY: number;
    /** Unit direction from start to end */
    dirX: number;
    dirY: number;
    /** Wall thickness */
    thickness: number;
    /** Wall height */
    height: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function vec2Sub(a: Point2D, b: Point2D): Point2D {
    return { x: a.x - b.x, y: a.y - b.y };
}

function vec2Add(a: Point2D, b: Point2D): Point2D {
    return { x: a.x + b.x, y: a.y + b.y };
}

function vec2Scale(v: Point2D, s: number): Point2D {
    return { x: v.x * s, y: v.y * s };
}

function vec2Length(v: Point2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vec2Normalize(v: Point2D): Point2D {
    const len = vec2Length(v);
    if (len < 1e-9) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

/** 2D cross product (z-component of the 3D cross product) */
function vec2Cross(a: Point2D, b: Point2D): number {
    return a.x * b.y - a.y * b.x;
}

function vec2Dot(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
}

/** Perpendicular (rotated 90° CCW): (-y, x) — this is the "left" normal */
function vec2PerpCCW(v: Point2D): Point2D {
    return { x: -v.y, y: v.x };
}

/**
 * Intersect two 2D lines, each defined by a point and a direction vector.
 * Returns the parameter `t` along line1 where the intersection occurs,
 * or null if the lines are parallel.
 *
 *   intersection = p1 + t * d1
 */
function lineLineIntersectT(
    p1: Point2D,
    d1: Point2D,
    p2: Point2D,
    d2: Point2D,
): number | null {
    const cross = vec2Cross(d1, d2);
    if (Math.abs(cross) < 1e-9) return null; // parallel
    const diff = vec2Sub(p2, p1);
    const t = vec2Cross(diff, d2) / cross;
    return t;
}

// ─── Core: get the direction a wall points away from a corner ───────────────

/**
 * For a wall connected to a corner, return the unit direction pointing
 * AWAY from that corner along the wall center line.
 */
function getWallDirectionFromCorner(
    wall: WallSegment,
    cornerId: string,
    corners: Record<string, CornerNode>,
): Point2D | null {
    const startCorner = corners[wall.startId];
    const endCorner = corners[wall.endId];
    if (!startCorner || !endCorner) return null;

    const isStart = wall.startId === cornerId;
    const from = isStart ? startCorner.position : endCorner.position;
    const to = isStart ? endCorner.position : startCorner.position;

    const dir = vec2Sub(to, from);
    const len = vec2Length(dir);
    if (len < 1e-9) return null;

    return vec2Normalize(dir);
}

// ─── Core: compute mitered offset point at a corner ─────────────────────────

/**
 * Returns the signed angle from direction `a` to direction `b`, measured
 * counter-clockwise.  Result is in (-PI, PI].
 */
function signedAngleBetween(a: Point2D, b: Point2D): number {
    return Math.atan2(vec2Cross(a, b), vec2Dot(a, b));
}

/**
 * Computes the mitered point at a shared corner for one side (left or right)
 * of a wall, taking into account the neighboring wall(s) at that corner.
 *
 * The approach:
 * 1. Sort all neighbor directions by angle around the corner.
 * 2. For LEFT side: find the immediate CCW neighbor.
 * 3. For RIGHT side: find the immediate CW neighbor.
 * 4. Intersect the wall's offset edge with the neighbor's offset edge to
 *    get the miter point.
 *    - For acute sectors (< π): use the neighbor's same-side edge → produces
 *      correct inner joints at T-junctions and X-crossings.
 *    - For reflex sectors (≥ π): use the neighbor's opposite-side edge →
 *      produces square butt joints at L-corners.
 * 5. For collinear (straight-through) neighbors the edges are parallel,
 *    so we fall back to a simple perpendicular cap (no miter needed).
 */
function computeMiteredPoint(
    cornerPos: Point2D,
    wallDir: Point2D,
    wallThickness: number,
    side: number, // +1 = left, -1 = right
    neighborDirs: Point2D[],
    neighborThicknesses: number[],
): Point2D {
    const normal = vec2PerpCCW(wallDir);
    const halfThick = wallThickness / 2;
    const offsetNormal = vec2Scale(normal, side * halfThick);
    const simplePoint = vec2Add(cornerPos, offsetNormal);

    if (neighborDirs.length === 0) {
        return simplePoint;
    }

    // Find the angular neighbor on the correct side.
    let bestIdx = -1;
    let bestSweep = Infinity;

    if (side > 0) {
        // LEFT side → immediate CCW neighbor (smallest CCW sweep in (0, 2π])
        for (let i = 0; i < neighborDirs.length; i++) {
            let a = signedAngleBetween(wallDir, neighborDirs[i]);
            if (a <= 1e-9) a += 2 * Math.PI;
            if (a < bestSweep) {
                bestSweep = a;
                bestIdx = i;
            }
        }
    } else {
        // RIGHT side → immediate CW neighbor (smallest CW sweep in (0, 2π])
        for (let i = 0; i < neighborDirs.length; i++) {
            let a = signedAngleBetween(wallDir, neighborDirs[i]);
            let cw = -a;
            if (cw <= 1e-9) cw += 2 * Math.PI;
            if (cw < bestSweep) {
                bestSweep = cw;
                bestIdx = i;
            }
        }
    }

    if (bestIdx === -1) {
        return simplePoint;
    }

    const nDir = neighborDirs[bestIdx];
    const nThickness = neighborThicknesses[bestIdx];
    const nNormal = vec2PerpCCW(nDir);

    // Our offset edge: corner + our perpendicular offset, along wallDir
    const ourEdgePoint = vec2Add(cornerPos, offsetNormal);
    const ourEdgeDir = wallDir;

    // Neighbor's matching edge depends on the angular sector between the walls:
    // - Acute sector (< π): use the neighbor's same-side edge. This makes
    //   walls at T-junctions and X-crossings trim to the correct inner point.
    // - Reflex sector (≥ π): use the neighbor's opposite-side edge. This
    //   extends the wall to cover the full corner square at L-junctions,
    //   producing clean square (butt-joint) corners instead of diagonal miters.
    const isAcuteSector = bestSweep < Math.PI - 1e-6;
    const neighborSide = isAcuteSector ? side : -side;
    const neighborOffsetNormal = vec2Scale(
        nNormal,
        (neighborSide * nThickness) / 2,
    );
    const neighborEdgePoint = vec2Add(cornerPos, neighborOffsetNormal);
    const neighborEdgeDir = nDir;

    const t = lineLineIntersectT(
        ourEdgePoint,
        ourEdgeDir,
        neighborEdgePoint,
        neighborEdgeDir,
    );

    if (t === null) {
        // Parallel edges (collinear walls) — no miter needed
        return simplePoint;
    }

    const miterPoint = vec2Add(ourEdgePoint, vec2Scale(ourEdgeDir, t));

    // Clamp miter extension to prevent spikes at very acute angles.
    const maxMiterDist = Math.max(wallThickness, nThickness) * 2;
    const miterDist = vec2Length(vec2Sub(miterPoint, simplePoint));

    if (miterDist > maxMiterDist) {
        const clampDir = vec2Normalize(vec2Sub(miterPoint, simplePoint));
        return vec2Add(simplePoint, vec2Scale(clampDir, maxMiterDist));
    }

    return miterPoint;
}

// ─── Main export: compute full wall geometry with mitered corners ────────────

/**
 * Computes the full 2D outline of a wall with mitered corners where it
 * connects to other walls at shared corner nodes.
 *
 * This is the primary function used by both Wall2D and Wall3D to get
 * the correct wall shape.
 *
 * @param wallId  - The ID of the wall to compute geometry for
 * @param walls   - All walls in the scene
 * @param corners - All corners in the scene
 * @returns ComputedWallGeometry or null if the wall/corners are invalid
 */
export function computeWallGeometry(
    wallId: string,
    walls: Record<string, WallSegment>,
    corners: Record<string, CornerNode>,
    defaultThickness: number = 0.4,
    defaultHeight: number = 2.2,
): ComputedWallGeometry | null {
    const wall = walls[wallId];
    if (!wall) return null;

    // Resolve nullable dimensions against plan defaults
    const thickness = wall.thickness ?? defaultThickness;
    const height = wall.height ?? defaultHeight;

    const startCorner = corners[wall.startId];
    const endCorner = corners[wall.endId];
    if (!startCorner || !endCorner) return null;

    const start = startCorner.position;
    const end = endCorner.position;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-9) return null;

    const dirX = dx / length;
    const dirY = dy / length;
    const normX = -dirY;
    const normY = dirX;

    const wallDir: Point2D = { x: dirX, y: dirY };
    const mid: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const angle = Math.atan2(dy, dx);

    // ── Find neighboring walls at start corner ─────────────────────────────────

    const startNeighborDirs: Point2D[] = [];
    const startNeighborThicknesses: number[] = [];

    for (const otherWall of Object.values(walls)) {
        if (otherWall.id === wallId) continue;
        // Only consider neighbors on the same floor
        if (otherWall.floorId !== wall.floorId) continue;
        if (
            otherWall.startId !== wall.startId &&
            otherWall.endId !== wall.startId
        )
            continue;

        const dir = getWallDirectionFromCorner(
            otherWall,
            wall.startId,
            corners,
        );
        if (dir) {
            startNeighborDirs.push(dir);
            startNeighborThicknesses.push(
                otherWall.thickness ?? defaultThickness,
            );
        }
    }

    // ── Find neighboring walls at end corner ───────────────────────────────────

    const endNeighborDirs: Point2D[] = [];
    const endNeighborThicknesses: number[] = [];

    for (const otherWall of Object.values(walls)) {
        if (otherWall.id === wallId) continue;
        // Only consider neighbors on the same floor
        if (otherWall.floorId !== wall.floorId) continue;
        if (otherWall.startId !== wall.endId && otherWall.endId !== wall.endId)
            continue;

        const dir = getWallDirectionFromCorner(otherWall, wall.endId, corners);
        if (dir) {
            endNeighborDirs.push(dir);
            endNeighborThicknesses.push(
                otherWall.thickness ?? defaultThickness,
            );
        }
    }

    // ── Compute mitered points at each end ─────────────────────────────────────

    // At the start corner, our wall direction points AWAY from start → toward end
    const startWallDir = wallDir;

    // At the end corner, our wall direction points AWAY from end → toward start
    const endWallDir: Point2D = { x: -wallDir.x, y: -wallDir.y };

    const leftStart = computeMiteredPoint(
        start,
        startWallDir,
        thickness,
        +1, // left side
        startNeighborDirs,
        startNeighborThicknesses,
    );

    const rightStart = computeMiteredPoint(
        start,
        startWallDir,
        thickness,
        -1, // right side
        startNeighborDirs,
        startNeighborThicknesses,
    );

    const leftEnd = computeMiteredPoint(
        end,
        endWallDir,
        thickness,
        -1, // left of the wall = right when looking from end toward start
        endNeighborDirs,
        endNeighborThicknesses,
    );

    const rightEnd = computeMiteredPoint(
        end,
        endWallDir,
        thickness,
        +1, // right of the wall = left when looking from end toward start
        endNeighborDirs,
        endNeighborThicknesses,
    );

    return {
        outline: { leftStart, leftEnd, rightStart, rightEnd },
        start,
        end,
        mid,
        length,
        angle,
        normX,
        normY,
        dirX,
        dirY,
        thickness,
        height,
    };
}
