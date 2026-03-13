import type { Point2D, CornerNode, WallSegment, Room } from "./types";
import { v4 as uuid } from "uuid";

// ─── Room Detection ─────────────────────────────────────────────────────────────
//
// Rooms are detected by finding all minimal cycles (faces) in the planar graph
// formed by corners (nodes) and walls (edges).
//
// Algorithm:
// 1. Build an adjacency list from walls, storing neighbor corner IDs.
// 2. For each directed edge, sort neighbors by angle around each node.
// 3. Use the "next edge CCW" traversal to find all minimal faces of the
//    planar subdivision (the half-edge / DCEL approach).
// 4. Discard the outer (infinite) face and any degenerate faces.
// 5. Compute centroid and area for each room polygon.
//
// This is the standard algorithm for extracting faces from a planar graph.
// ─────────────────────────────────────────────────────────────────────────────────

interface DirectedEdge {
    from: string;
    to: string;
    wallId: string;
    angle: number; // angle of the edge direction from `from` to `to`
}

/**
 * Compute the signed area of a polygon defined by an ordered list of 2D points.
 * Positive = CCW winding, negative = CW winding.
 */
function signedPolygonArea(points: Point2D[]): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

/**
 * Compute the centroid of a polygon defined by an ordered list of 2D points.
 */
function polygonCentroid(points: Point2D[]): Point2D {
    const n = points.length;
    let cx = 0;
    let cy = 0;
    let signedArea = 0;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const cross = points[i].x * points[j].y - points[j].x * points[i].y;
        signedArea += cross;
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
    }

    signedArea /= 2;

    if (Math.abs(signedArea) < 1e-9) {
        // Degenerate polygon — just average the points
        const avg = points.reduce(
            (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
            { x: 0, y: 0 },
        );
        return { x: avg.x / n, y: avg.y / n };
    }

    cx /= 6 * signedArea;
    cy /= 6 * signedArea;

    return { x: cx, y: cy };
}

/**
 * Find the wall ID connecting two corners, if any.
 */
function findWallBetween(
    fromId: string,
    toId: string,
    walls: Record<string, WallSegment>,
): string | null {
    for (const wall of Object.values(walls)) {
        if (
            (wall.startId === fromId && wall.endId === toId) ||
            (wall.startId === toId && wall.endId === fromId)
        ) {
            return wall.id;
        }
    }
    return null;
}

/**
 * Detect all rooms (minimal closed cycles) in the wall graph.
 *
 * Preserves names from previously detected rooms by matching on the sorted
 * set of corner IDs — if a cycle has the same corners as before, the old
 * name is kept.
 */
/**
 * Detect rooms on a single floor by filtering corners/walls to only those on the floor.
 */
function detectRoomsForFloor(
    floorId: string,
    allCorners: Record<string, CornerNode>,
    allWalls: Record<string, WallSegment>,
    existingRooms: Record<string, Room>,
): Record<string, Room> {
    const corners: Record<string, CornerNode> = {};
    for (const [id, c] of Object.entries(allCorners)) {
        if (c.floorId === floorId) corners[id] = c;
    }
    const walls: Record<string, WallSegment> = {};
    for (const [id, w] of Object.entries(allWalls)) {
        if (w.floorId === floorId) walls[id] = w;
    }
    const floorExisting: Record<string, Room> = {};
    for (const [id, r] of Object.entries(existingRooms)) {
        if (r.floorId === floorId) floorExisting[id] = r;
    }

    const cornerIds = Object.keys(corners);
    const wallList = Object.values(walls);

    if (cornerIds.length < 3 || wallList.length < 3) {
        return {};
    }

    // ── Step 1: Build adjacency list with angles ────────────────────────────

    // For each corner, collect all directed edges leaving it, sorted by angle
    const adjacency: Record<string, DirectedEdge[]> = {};

    for (const cid of cornerIds) {
        adjacency[cid] = [];
    }

    for (const wall of wallList) {
        const startPos = corners[wall.startId]?.position;
        const endPos = corners[wall.endId]?.position;
        if (!startPos || !endPos) continue;

        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) continue;

        const angleForward = Math.atan2(dy, dx);
        const angleBackward = Math.atan2(-dy, -dx);

        adjacency[wall.startId]?.push({
            from: wall.startId,
            to: wall.endId,
            wallId: wall.id,
            angle: angleForward,
        });

        adjacency[wall.endId]?.push({
            from: wall.endId,
            to: wall.startId,
            wallId: wall.id,
            angle: angleBackward,
        });
    }

    // Sort each corner's edges by angle
    for (const cid of cornerIds) {
        adjacency[cid].sort((a, b) => a.angle - b.angle);
    }

    // ── Step 2: Build "next edge" map using planar face traversal ───────────
    //
    // For each directed edge (from → to), the "next" edge in the face traversal
    // is found by: at node `to`, look at the incoming direction (to → from),
    // find that angle in `to`'s sorted adjacency, then pick the NEXT edge CW
    // (which is the previous entry in the CCW-sorted list).

    // Map: "from:to" → next directed edge
    const nextEdge: Record<string, DirectedEdge | null> = {};

    for (const wall of wallList) {
        // Process both directions
        for (const [fromId, toId] of [
            [wall.startId, wall.endId],
            [wall.endId, wall.startId],
        ]) {
            const key = `${fromId}:${toId}`;
            const adj = adjacency[toId];
            if (!adj || adj.length === 0) {
                nextEdge[key] = null;
                continue;
            }

            // The incoming direction at `toId` is from `fromId` to `toId`.
            // We need to find the edge leaving `toId` that is the next one CW
            // from the reverse of our incoming direction.
            // Reverse direction: toId → fromId
            const fromPos = corners[fromId]?.position;
            const toPos = corners[toId]?.position;
            if (!fromPos || !toPos) {
                nextEdge[key] = null;
                continue;
            }

            const incomingAngle = Math.atan2(
                fromPos.y - toPos.y,
                fromPos.x - toPos.x,
            );

            // Find the edge in adj whose angle is just BELOW (CW from) incomingAngle
            // In the CCW-sorted list, "next CW" means the previous entry.
            // Find the first edge with angle > incomingAngle, then take the one before it.
            let idx = -1;
            for (let i = 0; i < adj.length; i++) {
                if (adj[i].angle > incomingAngle + 1e-9) {
                    idx = i;
                    break;
                }
            }

            if (idx === -1) {
                // All angles are ≤ incomingAngle → wrap around: the "next CW" is the first one
                idx = 0;
            }

            // The next CW edge from incomingAngle is at idx-1 (wrapping)
            const prevIdx = (idx - 1 + adj.length) % adj.length;
            const candidate = adj[prevIdx];

            // Don't traverse back along the same edge we came from
            if (candidate.to === fromId && adj.length > 1) {
                // Pick the next one CW instead
                const altIdx = (prevIdx - 1 + adj.length) % adj.length;
                nextEdge[key] = adj[altIdx];
            } else {
                nextEdge[key] = candidate;
            }
        }
    }

    // ── Step 3: Traverse all faces ──────────────────────────────────────────

    const visitedEdges = new Set<string>();
    const cycles: string[][] = []; // each cycle is a list of corner IDs

    for (const wall of wallList) {
        for (const [fromId, toId] of [
            [wall.startId, wall.endId],
            [wall.endId, wall.startId],
        ]) {
            const startKey = `${fromId}:${toId}`;
            if (visitedEdges.has(startKey)) continue;

            // Traverse the face
            const cycle: string[] = [];
            let currentFrom = fromId;
            let currentTo = toId;
            let valid = true;
            const maxSteps = cornerIds.length + 1;
            let steps = 0;

            while (steps < maxSteps) {
                const edgeKey = `${currentFrom}:${currentTo}`;
                if (visitedEdges.has(edgeKey)) {
                    // Check if we completed a full cycle back to start
                    if (edgeKey === startKey && cycle.length >= 3) {
                        break;
                    }
                    valid = false;
                    break;
                }

                visitedEdges.add(edgeKey);
                cycle.push(currentFrom);

                const next = nextEdge[edgeKey];
                if (!next) {
                    valid = false;
                    break;
                }

                currentFrom = next.from;
                currentTo = next.to;
                steps++;
            }

            if (valid && cycle.length >= 3 && steps < maxSteps) {
                cycles.push(cycle);
            }
        }
    }

    // ── Step 4: Filter out the outer face and degenerate cycles ─────────────

    const rooms: Record<string, Room> = {};

    // Build a lookup from sorted corner-id sets to existing room names
    const existingRoomsByKey: Record<string, Room> = {};
    for (const room of Object.values(floorExisting)) {
        const key = [...room.cornerIds].sort().join(",");
        existingRoomsByKey[key] = room;
    }

    for (const cycle of cycles) {
        // Get polygon points
        const points: Point2D[] = cycle
            .map((cid) => corners[cid]?.position)
            .filter((p): p is Point2D => p != null);

        if (points.length < 3) continue;

        const area = signedPolygonArea(points);

        // Discard the outer (infinite) face — it has CW winding (negative area)
        // We only keep CCW faces (positive area) = interior rooms
        if (area <= 1e-6) continue;

        // Collect wall IDs for this cycle
        const wallIds: string[] = [];
        for (let i = 0; i < cycle.length; i++) {
            const j = (i + 1) % cycle.length;
            const wid = findWallBetween(cycle[i], cycle[j], walls);
            if (wid) wallIds.push(wid);
        }

        // Must have a wall for every edge
        if (wallIds.length !== cycle.length) continue;

        const center = polygonCentroid(points);

        // Check if this cycle matches an existing room (by corner set)
        const sortedKey = [...cycle].sort().join(",");
        const existing = existingRoomsByKey[sortedKey];

        const roomId = existing?.id ?? uuid();
        const roomName = existing?.name ?? "Room";

        rooms[roomId] = {
            id: roomId,
            floorId,
            name: roomName,
            cornerIds: cycle,
            wallIds,
            center,
            area,
        };
    }

    return rooms;
}

/**
 * Detect all rooms (minimal closed cycles) in the wall graph.
 *
 * Preserves names from previously detected rooms by matching on the sorted
 * set of corner IDs — if a cycle has the same corners as before, the old
 * name is kept.
 *
 * Runs detection per-floor so walls on different floors don't interfere.
 */
export function detectRooms(
    corners: Record<string, CornerNode>,
    walls: Record<string, WallSegment>,
    existingRooms: Record<string, Room>,
): Record<string, Room> {
    // Collect all unique floor IDs from corners and walls
    const floorIds = new Set<string>();
    for (const c of Object.values(corners)) floorIds.add(c.floorId);
    for (const w of Object.values(walls)) floorIds.add(w.floorId);

    const allRooms: Record<string, Room> = {};
    for (const floorId of floorIds) {
        const floorRooms = detectRoomsForFloor(floorId, corners, walls, existingRooms);
        Object.assign(allRooms, floorRooms);
    }
    return allRooms;
}
