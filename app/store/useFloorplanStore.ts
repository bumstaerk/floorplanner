import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type {
    FloorplanState,
    CornerNode,
    WallSegment,
    WallOpening,
    WallComponent,
    RoomComponent,
    FloorplanImage,
    StaircaseOpening,
    Floor,
    Point2D,
    HistoryEntry,
    ModelTheme,
} from "./types";
import { defaultModelThemeLight } from "./types";
import { detectRooms } from "./roomDetection";

const DEFAULT_WALL_THICKNESS = 0.4; // meters
const DEFAULT_WALL_HEIGHT = 2.2; // meters
const DEFAULT_FLOOR_HEIGHT = 2.8; // meters

function createDefaultFloor(): Floor {
    return {
        id: uuid(),
        name: "Ground Floor",
        level: 0,
        floorHeight: DEFAULT_FLOOR_HEIGHT,
    };
}

function makeHistoryEntry(
    corners: Record<string, CornerNode>,
    walls: Record<string, WallSegment>,
    staircaseOpenings: Record<string, StaircaseOpening>,
): HistoryEntry {
    return {
        corners: JSON.parse(JSON.stringify(corners)),
        walls: JSON.parse(JSON.stringify(walls)),
        staircaseOpenings: JSON.parse(JSON.stringify(staircaseOpenings)),
    };
}

function distance(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

const initialFloor = createDefaultFloor();

export const useFloorplanStore = create<FloorplanState>((set, get) => ({
    // ── Data ──────────────────────────────────────────────────────────────────
    corners: {},
    walls: {},
    rooms: {},
    floorplan: null,

    // ── Floors ────────────────────────────────────────────────────────────────
    floors: [initialFloor],
    currentFloorId: initialFloor.id,
    staircaseOpenings: {},

    // ── Plan persistence ──────────────────────────────────────────────────────
    currentPlanId: null,
    currentPlanName: "Untitled Plan",
    saving: false,
    loading: false,

    // ── Editor ────────────────────────────────────────────────────────────────
    mode: "build",
    activeTool: "wall",
    selectedWallId: null,
    selectedCornerId: null,
    selectedRoomId: null,
    selectedStaircaseId: null,
    hoveredWallId: null,
    hoveredCornerId: null,
    drawingFromCornerId: null,
    drawingCursor: null,

    // ── Settings ──────────────────────────────────────────────────────────────
    snap: {
        enabled: true,
        gridSize: 0.1,
        cornerSnapRadius: 0.25,
        angleSnap: 45,
    },
    grid: {
        visible: true,
        size: 50,
        divisions: 50,
    },
    defaultWallThickness: DEFAULT_WALL_THICKNESS,
    defaultWallHeight: DEFAULT_WALL_HEIGHT,

    // ── Model theme ────────────────────────────────────────────────────────────
    modelTheme: { ...defaultModelThemeLight },

    // ── History ───────────────────────────────────────────────────────────────
    history: [],
    historyIndex: -1,

    // ── Actions: floors ─────────────────────────────────────────────────────────
    addFloor: () => {
        const id = uuid();
        set((s) => {
            const maxLevel = Math.max(...s.floors.map((f) => f.level), -1);
            const newFloor: Floor = {
                id,
                name: `Floor ${maxLevel + 1}`,
                level: maxLevel + 1,
                floorHeight: DEFAULT_FLOOR_HEIGHT,
            };
            return {
                floors: [...s.floors, newFloor],
                currentFloorId: id,
                // Clear selections and drawing when switching floor
                selectedWallId: null,
                selectedCornerId: null,
                selectedRoomId: null,
                selectedStaircaseId: null,
                drawingFromCornerId: null,
                drawingCursor: null,
            };
        });
        return id;
    },

    removeFloor: (floorId) =>
        set((s) => {
            if (s.floors.length <= 1) return s;

            const remaining = s.floors.filter((f) => f.id !== floorId);
            // Remove all geometry on this floor
            const corners: Record<string, CornerNode> = {};
            for (const [cid, c] of Object.entries(s.corners)) {
                if (c.floorId !== floorId) corners[cid] = c;
            }
            const walls: Record<string, WallSegment> = {};
            for (const [wid, w] of Object.entries(s.walls)) {
                if (w.floorId !== floorId) walls[wid] = w;
            }
            const rooms: typeof s.rooms = {};
            for (const [rid, r] of Object.entries(s.rooms)) {
                if (r.floorId !== floorId) rooms[rid] = r;
            }
            const staircaseOpenings: Record<string, StaircaseOpening> = {};
            for (const [sid, so] of Object.entries(s.staircaseOpenings)) {
                if (so.floorId !== floorId) staircaseOpenings[sid] = so;
            }
            // Remove floorplan image if it belongs to this floor
            const floorplan = s.floorplan?.floorId === floorId ? null : s.floorplan;

            // Switch to nearest floor
            let newCurrentFloorId = s.currentFloorId;
            if (s.currentFloorId === floorId) {
                const sorted = [...remaining].sort((a, b) => a.level - b.level);
                newCurrentFloorId = sorted[0].id;
            }

            return {
                floors: remaining,
                currentFloorId: newCurrentFloorId,
                corners,
                walls,
                rooms,
                staircaseOpenings,
                floorplan,
                selectedWallId: null,
                selectedCornerId: null,
                selectedRoomId: null,
                selectedStaircaseId: null,
                drawingFromCornerId: null,
                drawingCursor: null,
            };
        }),

    updateFloor: (floorId, patch) =>
        set((s) => ({
            floors: s.floors.map((f) =>
                f.id === floorId ? { ...f, ...patch } : f,
            ),
        })),

    setCurrentFloor: (floorId) =>
        set(() => ({
            currentFloorId: floorId,
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
            selectedStaircaseId: null,
            drawingFromCornerId: null,
            drawingCursor: null,
        })),

    // ── Actions: staircase openings ──────────────────────────────────────────
    addStaircaseOpening: (position) => {
        const id = uuid();
        set((s) => ({
            staircaseOpenings: {
                ...s.staircaseOpenings,
                [id]: {
                    id,
                    floorId: s.currentFloorId,
                    position: { ...position },
                    width: 1.0,
                    depth: 2.5,
                    rotation: 0,
                },
            },
        }));
        return id;
    },

    removeStaircaseOpening: (id) =>
        set((s) => {
            const { [id]: _, ...remaining } = s.staircaseOpenings;
            return {
                staircaseOpenings: remaining,
                selectedStaircaseId:
                    s.selectedStaircaseId === id ? null : s.selectedStaircaseId,
            };
        }),

    updateStaircaseOpening: (id, patch) =>
        set((s) => {
            const existing = s.staircaseOpenings[id];
            if (!existing) return s;
            return {
                staircaseOpenings: {
                    ...s.staircaseOpenings,
                    [id]: { ...existing, ...patch },
                },
            };
        }),

    selectStaircaseOpening: (id) =>
        set(() => ({
            selectedStaircaseId: id,
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
        })),

    // ── Actions: rooms ────────────────────────────────────────────────────────
    detectRooms: () =>
        set((s) => ({
            rooms: detectRooms(s.corners, s.walls, s.rooms),
        })),

    updateRoom: (id, patch) =>
        set((s) => {
            const room = s.rooms[id];
            if (!room) return s;
            return {
                rooms: {
                    ...s.rooms,
                    [id]: { ...room, ...patch },
                },
            };
        }),

    selectRoom: (id) =>
        set({
            selectedRoomId: id,
            selectedWallId: null,
            selectedCornerId: null,
            selectedStaircaseId: null,
        }),

    // ── Actions: room components ──────────────────────────────────────────────

    addRoomComponent: (roomId, component) =>
        set((s) => {
            const room = s.rooms[roomId];
            if (!room) return s;
            const newComponent: RoomComponent = {
                id: uuid(),
                ...component,
            };
            return {
                rooms: {
                    ...s.rooms,
                    [roomId]: {
                        ...room,
                        components: [...room.components, newComponent],
                    },
                },
            };
        }),

    removeRoomComponent: (roomId, componentId) =>
        set((s) => {
            const room = s.rooms[roomId];
            if (!room) return s;
            return {
                rooms: {
                    ...s.rooms,
                    [roomId]: {
                        ...room,
                        components: room.components.filter(
                            (c) => c.id !== componentId,
                        ),
                    },
                },
            };
        }),

    updateRoomComponent: (roomId, componentId, patch) =>
        set((s) => {
            const room = s.rooms[roomId];
            if (!room) return s;
            return {
                rooms: {
                    ...s.rooms,
                    [roomId]: {
                        ...room,
                        components: room.components.map((c) =>
                            c.id === componentId ? { ...c, ...patch } : c,
                        ),
                    },
                },
            };
        }),

    // ── Actions: mode / tool ──────────────────────────────────────────────────
    setMode: (mode) =>
        set((s) => {
            // Cancel any in-progress drawing when switching modes
            if (mode === "preview") {
                return {
                    mode,
                    activeTool: "select",
                    drawingFromCornerId: null,
                    drawingCursor: null,
                    selectedWallId: null,
                    selectedCornerId: null,
                };
            }
            return { mode };
        }),

    setActiveTool: (tool) =>
        set(() => ({
            activeTool: tool,
            drawingFromCornerId: null,
            drawingCursor: null,
        })),

    // ── Actions: floorplan image ──────────────────────────────────────────────
    setFloorplan: (image: FloorplanImage) => set((s) => ({ floorplan: { ...image, floorId: s.currentFloorId } })),

    updateFloorplan: (patch) =>
        set((s) => {
            if (!s.floorplan) return s;
            return { floorplan: { ...s.floorplan, ...patch } };
        }),

    removeFloorplan: () =>
        set((s) => {
            if (s.floorplan) {
                URL.revokeObjectURL(s.floorplan.url);
            }
            return { floorplan: null };
        }),

    // ── Actions: corners ──────────────────────────────────────────────────────
    addCorner: (position) => {
        const id = uuid();
        set((s) => ({
            corners: {
                ...s.corners,
                [id]: { id, position: { ...position }, floorId: s.currentFloorId },
            },
        }));
        return id;
    },

    moveCorner: (id, position) =>
        set((s) => {
            const corner = s.corners[id];
            if (!corner) return s;
            return {
                corners: {
                    ...s.corners,
                    [id]: { ...corner, position: { ...position } },
                },
            };
        }),

    removeCorner: (id) =>
        set((s) => {
            const { [id]: _, ...remainingCorners } = s.corners;
            // Also remove all walls connected to this corner
            const remainingWalls: Record<string, WallSegment> = {};
            for (const [wid, wall] of Object.entries(s.walls)) {
                if (wall.startId !== id && wall.endId !== id) {
                    remainingWalls[wid] = wall;
                }
            }
            return { corners: remainingCorners, walls: remainingWalls };
        }),

    // ── Actions: walls ────────────────────────────────────────────────────────
    addWall: (startId, endId) => {
        const state = get();
        // Don't allow a wall from a corner to itself
        if (startId === endId) return "";
        // Don't allow duplicate walls between the same two corners on the same floor
        const existing = Object.values(state.walls).find(
            (w) =>
                w.floorId === state.currentFloorId &&
                ((w.startId === startId && w.endId === endId) ||
                (w.startId === endId && w.endId === startId)),
        );
        if (existing) return existing.id;

        const id = uuid();
        set((s) => ({
            walls: {
                ...s.walls,
                [id]: {
                    id,
                    floorId: s.currentFloorId,
                    startId,
                    endId,
                    thickness: null,
                    height: null,
                    visible: true,
                    openings: [],
                    components: [],
                },
            },
        }));
        return id;
    },

    removeWall: (id) =>
        set((s) => {
            const { [id]: removed, ...remainingWalls } = s.walls;
            if (!removed) return s;

            // Clean up orphaned corners (corners not referenced by any remaining wall)
            const usedCornerIds = new Set<string>();
            for (const wall of Object.values(remainingWalls)) {
                usedCornerIds.add(wall.startId);
                usedCornerIds.add(wall.endId);
            }

            const remainingCorners: Record<string, CornerNode> = {};
            for (const [cid, corner] of Object.entries(s.corners)) {
                if (usedCornerIds.has(cid)) {
                    remainingCorners[cid] = corner;
                }
            }

            return {
                walls: remainingWalls,
                corners: remainingCorners,
                selectedWallId:
                    s.selectedWallId === id ? null : s.selectedWallId,
            };
        }),

    updateWall: (id, patch) =>
        set((s) => {
            const wall = s.walls[id];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [id]: { ...wall, ...patch },
                },
            };
        }),

    // ── Actions: openings ─────────────────────────────────────────────────────
    addOpening: (wallId, opening) => {
        const id = uuid();
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        openings: [...wall.openings, { ...opening, id }],
                    },
                },
            };
        });
        return id;
    },

    removeOpening: (wallId, openingId) =>
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        openings: wall.openings.filter(
                            (o) => o.id !== openingId,
                        ),
                    },
                },
            };
        }),

    updateOpening: (wallId, openingId, patch) =>
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        openings: wall.openings.map((o) =>
                            o.id === openingId ? { ...o, ...patch } : o,
                        ),
                    },
                },
            };
        }),

    // ── Actions: components ───────────────────────────────────────────────────
    addComponent: (wallId, component) => {
        const id = uuid();
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        components: [...wall.components, { ...component, id }],
                    },
                },
            };
        });
        return id;
    },

    removeComponent: (wallId, componentId) =>
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        components: wall.components.filter(
                            (c) => c.id !== componentId,
                        ),
                    },
                },
            };
        }),

    updateComponent: (wallId, componentId, patch) =>
        set((s) => {
            const wall = s.walls[wallId];
            if (!wall) return s;
            return {
                walls: {
                    ...s.walls,
                    [wallId]: {
                        ...wall,
                        components: wall.components.map((c) =>
                            c.id === componentId ? { ...c, ...patch } : c,
                        ),
                    },
                },
            };
        }),

    // ── Actions: split wall ───────────────────────────────────────────────────
    splitWall: (wallId, position) => {
        const state = get();
        const wall = state.walls[wallId];
        if (!wall) return "";

        const startCorner = state.corners[wall.startId];
        const endCorner = state.corners[wall.endId];
        if (!startCorner || !endCorner) return "";

        // Create a new corner at the split position
        const newCornerId = state.addCorner(position);

        // Save original wall properties
        const originalEndId = wall.endId;
        const { thickness, height, visible } = wall;
        const originalOpenings = [...wall.openings];
        const originalComponents = [...wall.components];

        // Compute split distance from start corner to new split point
        const splitDist = distance(startCorner.position, position);

        // Partition openings: first wall keeps openings that fit before the split
        // (including those that straddle), second wall gets the rest
        const firstWallOpenings: WallOpening[] = [];
        const secondWallOpenings: WallOpening[] = [];
        for (const opening of originalOpenings) {
            if (opening.offset >= splitDist) {
                // Entirely on the second wall — adjust offset
                secondWallOpenings.push({
                    ...opening,
                    offset: opening.offset - splitDist,
                });
            } else {
                // Stays on the first wall (including straddling ones)
                firstWallOpenings.push(opening);
            }
        }

        // Partition components: offset < splitDist stays, offset >= splitDist moves
        const firstWallComponents: WallComponent[] = [];
        const secondWallComponents: WallComponent[] = [];
        for (const component of originalComponents) {
            if (component.offset >= splitDist) {
                secondWallComponents.push({
                    ...component,
                    offset: component.offset - splitDist,
                });
            } else {
                firstWallComponents.push(component);
            }
        }

        // Update the original wall: end at the new corner, keep first-half items
        set((s) => ({
            walls: {
                ...s.walls,
                [wallId]: {
                    ...s.walls[wallId],
                    endId: newCornerId,
                    openings: firstWallOpenings,
                    components: firstWallComponents,
                },
            },
        }));

        // Create the new wall from the new corner to the original end
        const newWallId = uuid();
        set((s) => ({
            walls: {
                ...s.walls,
                [newWallId]: {
                    id: newWallId,
                    floorId: wall.floorId,
                    startId: newCornerId,
                    endId: originalEndId,
                    thickness,
                    height,
                    visible,
                    openings: secondWallOpenings,
                    components: secondWallComponents,
                },
            },
        }));

        return newCornerId;
    },

    // ── Helpers: find wall at point ───────────────────────────────────────────
    findWallAtPoint: (position) => {
        const state = get();
        let bestWallId: string | null = null;
        let bestDist = Infinity;
        let bestPoint: Point2D = { x: 0, y: 0 };

        for (const wall of Object.values(state.walls)) {
            // Only find walls on the current floor
            if (wall.floorId !== state.currentFloorId) continue;
            const startCorner = state.corners[wall.startId];
            const endCorner = state.corners[wall.endId];
            if (!startCorner || !endCorner) continue;

            const ax = startCorner.position.x;
            const ay = startCorner.position.y;
            const bx = endCorner.position.x;
            const by = endCorner.position.y;

            const dx = bx - ax;
            const dy = by - ay;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;

            // Projection parameter t (0..1) along the wall center line
            const t = ((position.x - ax) * dx + (position.y - ay) * dy) / lenSq;

            if (t < 0 || t > 1) continue;

            // Closest point on the wall center line
            const projX = ax + t * dx;
            const projY = ay + t * dy;

            const perpDist = distance(position, { x: projX, y: projY });
            const tolerance =
                (wall.thickness ?? get().defaultWallThickness) / 2 + 0.1;

            if (perpDist <= tolerance && perpDist < bestDist) {
                bestDist = perpDist;
                bestWallId = wall.id;
                bestPoint = { x: projX, y: projY };
            }
        }

        if (bestWallId === null) return null;
        return { wallId: bestWallId, point: bestPoint };
    },

    // ── Actions: drawing ──────────────────────────────────────────────────────
    startDrawing: (cornerId) =>
        set(() => ({
            drawingFromCornerId: cornerId,
            drawingCursor: null,
        })),

    updateDrawingCursor: (cursor) => set(() => ({ drawingCursor: cursor })),

    finishDrawing: (cornerId) => {
        const state = get();
        if (!state.drawingFromCornerId) return;
        if (state.drawingFromCornerId === cornerId) return;

        // Push history before mutation
        state.pushHistory();

        const wallId = state.addWall(state.drawingFromCornerId, cornerId);

        // Continue drawing from the new corner (chain walls)
        set(() => ({
            drawingFromCornerId: cornerId,
            drawingCursor: null,
        }));
    },

    cancelDrawing: () =>
        set(() => ({
            drawingFromCornerId: null,
            drawingCursor: null,
        })),

    // ── Actions: selection / hover ────────────────────────────────────────────
    selectWall: (id) =>
        set(() => ({
            selectedWallId: id,
            selectedCornerId: null,
            selectedRoomId: null,
            selectedStaircaseId: null,
        })),

    selectCorner: (id) =>
        set(() => ({
            selectedCornerId: id,
            selectedWallId: null,
            selectedRoomId: null,
            selectedStaircaseId: null,
        })),

    setHoveredWall: (id) => set(() => ({ hoveredWallId: id })),
    setHoveredCorner: (id) => set(() => ({ hoveredCornerId: id })),

    // ── Actions: snap & grid ──────────────────────────────────────────────────
    updateSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),

    updateGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),

    setDefaultWallThickness: (v) => set(() => ({ defaultWallThickness: v })),
    setDefaultWallHeight: (v) => set(() => ({ defaultWallHeight: v })),

    // ── Actions: model theme ─────────────────────────────────────────────────
    updateModelTheme: (patch) =>
        set((s) => ({ modelTheme: { ...s.modelTheme, ...patch } })),
    resetModelTheme: () =>
        set(() => ({ modelTheme: { ...defaultModelThemeLight } })),

    // ── Actions: history ──────────────────────────────────────────────────────
    pushHistory: () =>
        set((s) => {
            const entry = makeHistoryEntry(s.corners, s.walls, s.staircaseOpenings);
            // Truncate any future entries if we've undone some steps
            const truncated = s.history.slice(0, s.historyIndex + 1);
            const newHistory = [...truncated, entry];
            // Cap history at 100 entries
            if (newHistory.length > 100) {
                newHistory.shift();
            }
            return {
                history: newHistory,
                historyIndex: newHistory.length - 1,
            };
        }),

    undo: () =>
        set((s) => {
            if (s.historyIndex < 0) return s;
            const entry = s.history[s.historyIndex];
            return {
                corners: JSON.parse(JSON.stringify(entry.corners)),
                walls: JSON.parse(JSON.stringify(entry.walls)),
                staircaseOpenings: JSON.parse(JSON.stringify(entry.staircaseOpenings)),
                historyIndex: s.historyIndex - 1,
                selectedWallId: null,
                selectedCornerId: null,
                selectedStaircaseId: null,
                drawingFromCornerId: null,
                drawingCursor: null,
            };
        }),

    redo: () =>
        set((s) => {
            if (s.historyIndex >= s.history.length - 2) return s;
            const nextIndex = s.historyIndex + 2;
            if (nextIndex >= s.history.length) return s;
            const entry = s.history[nextIndex];
            return {
                corners: JSON.parse(JSON.stringify(entry.corners)),
                walls: JSON.parse(JSON.stringify(entry.walls)),
                staircaseOpenings: JSON.parse(JSON.stringify(entry.staircaseOpenings)),
                historyIndex: nextIndex - 1,
                selectedWallId: null,
                selectedCornerId: null,
                selectedStaircaseId: null,
            };
        }),

    // ── Helpers ───────────────────────────────────────────────────────────────
    findSnapCorner: (position) => {
        const state = get();
        if (!state.snap.enabled) return null;
        let nearest: CornerNode | null = null;
        let nearestDist = Infinity;
        for (const corner of Object.values(state.corners)) {
            // Only snap to corners on the current floor
            if (corner.floorId !== state.currentFloorId) continue;
            const d = distance(corner.position, position);
            if (d < state.snap.cornerSnapRadius && d < nearestDist) {
                nearest = corner;
                nearestDist = d;
            }
        }
        return nearest;
    },

    snapToGrid: (position) => {
        const state = get();
        if (!state.snap.enabled) return position;
        const gs = state.snap.gridSize;
        return {
            x: Math.round(position.x / gs) * gs,
            y: Math.round(position.y / gs) * gs,
        };
    },

    getWallsAtCorner: (cornerId) => {
        const state = get();
        return Object.values(state.walls)
            .filter((w) => w.floorId === state.currentFloorId && (w.startId === cornerId || w.endId === cornerId))
            .map((w) => w.id);
    },

    getWallLength: (wallId) => {
        const state = get();
        const wall = state.walls[wallId];
        if (!wall) return 0;
        const start = state.corners[wall.startId];
        const end = state.corners[wall.endId];
        if (!start || !end) return 0;
        return distance(start.position, end.position);
    },

    getResolvedWallThickness: (wallId) => {
        const state = get();
        const wall = state.walls[wallId];
        if (!wall) return state.defaultWallThickness;
        return wall.thickness ?? state.defaultWallThickness;
    },

    getResolvedWallHeight: (wallId) => {
        const state = get();
        const wall = state.walls[wallId];
        if (!wall) return state.defaultWallHeight;
        return wall.height ?? state.defaultWallHeight;
    },

    // ── Plan persistence ─────────────────────────────────────────────────────

    savePlan: async (name) => {
        const state = get();
        set({ saving: true });
        try {
            const planName = name ?? state.currentPlanName ?? "Untitled Plan";

            // Convert blob URL floorplan image to base64 data URL for persistence
            let floorplanPayload: any = null;
            if (state.floorplan) {
                let imageDataUrl = state.floorplan.url;
                // If the URL is a blob URL, convert it to a data URL
                if (imageDataUrl.startsWith("blob:")) {
                    const response = await fetch(imageDataUrl);
                    const blob = await response.blob();
                    imageDataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () =>
                            resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                }
                floorplanPayload = {
                    floorId: state.floorplan.floorId,
                    url: imageDataUrl,
                    name: state.floorplan.name,
                    widthMeters: state.floorplan.widthMeters,
                    heightMeters: state.floorplan.heightMeters,
                    scale: state.floorplan.scale ?? 1,
                    opacity: state.floorplan.opacity,
                };
            }

            const res = await fetch("/api/plans/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: state.currentPlanId,
                    name: planName,
                    defaultWallThickness: state.defaultWallThickness,
                    defaultWallHeight: state.defaultWallHeight,
                    modelTheme: state.modelTheme,
                    floors: state.floors,
                    corners: state.corners,
                    walls: state.walls,
                    floorplan: floorplanPayload,
                    staircaseOpenings: state.staircaseOpenings,
                    roomComponents: Object.values(state.rooms).flatMap((room) => {
                        const roomKey = [...room.cornerIds].sort().join(",");
                        return room.components.map((comp) => ({
                            id: comp.id,
                            floorId: room.floorId,
                            roomKey,
                            type: comp.type,
                            label: comp.label,
                            x: comp.x,
                            y: comp.y,
                            meta: comp.meta,
                        }));
                    }),
                }),
            });
            if (!res.ok) throw new Error("Save failed");
            const data = await res.json();
            set({
                currentPlanId: data.id,
                currentPlanName: data.name,
                saving: false,
            });
        } catch (err) {
            console.error("Failed to save plan:", err);
            set({ saving: false });
        }
    },

    loadPlan: async (id) => {
        set({ loading: true });
        try {
            const res = await fetch(`/api/plans/${id}`);
            if (!res.ok) throw new Error("Load failed");
            const data = await res.json();
            const loadedFloors: Floor[] = data.floors?.length
                ? data.floors
                : [createDefaultFloor()];
            const currentFloorId = loadedFloors.sort((a, b) => a.level - b.level)[0].id;
            set({
                currentPlanId: data.id,
                currentPlanName: data.name,
                defaultWallThickness:
                    data.defaultWallThickness ?? DEFAULT_WALL_THICKNESS,
                defaultWallHeight:
                    data.defaultWallHeight ?? DEFAULT_WALL_HEIGHT,
                floors: loadedFloors,
                currentFloorId,
                corners: data.corners ?? {},
                walls: data.walls ?? {},
                rooms: {},
                floorplan: data.floorplan
                    ? {
                          floorId: data.floorplan.floorId ?? currentFloorId,
                          url: data.floorplan.url,
                          name: data.floorplan.name,
                          widthMeters: data.floorplan.widthMeters,
                          heightMeters: data.floorplan.heightMeters,
                          scale: data.floorplan.scale ?? 1,
                          opacity: data.floorplan.opacity ?? 0.5,
                      }
                    : null,
                staircaseOpenings: data.staircaseOpenings ?? {},
                modelTheme: data.modelTheme ?? { ...defaultModelThemeLight },
                selectedWallId: null,
                selectedCornerId: null,
                selectedRoomId: null,
                selectedStaircaseId: null,
                hoveredWallId: null,
                hoveredCornerId: null,
                drawingFromCornerId: null,
                drawingCursor: null,
                history: [],
                historyIndex: -1,
                loading: false,
            });
            // Trigger room detection after loading
            queueMicrotask(() => {
                useFloorplanStore.getState().detectRooms();
            });
        } catch (err) {
            console.error("Failed to load plan:", err);
            set({ loading: false });
        }
    },

    hydratePlan: (data) => {
        const hydratedFloors: Floor[] = data.floors?.length
            ? data.floors
            : [createDefaultFloor()];
        const currentFloorId = [...hydratedFloors].sort((a, b) => a.level - b.level)[0].id;
        set({
            currentPlanId: data.id,
            currentPlanName: data.name,
            defaultWallThickness:
                data.defaultWallThickness ?? DEFAULT_WALL_THICKNESS,
            defaultWallHeight: data.defaultWallHeight ?? DEFAULT_WALL_HEIGHT,
            floors: hydratedFloors,
            currentFloorId,
            corners: data.corners ?? {},
            walls: data.walls ?? {},
            rooms: {},
            floorplan: data.floorplan
                ? {
                      floorId: data.floorplan.floorId ?? currentFloorId,
                      url: data.floorplan.url,
                      name: data.floorplan.name,
                      widthMeters: data.floorplan.widthMeters,
                      heightMeters: data.floorplan.heightMeters,
                      scale: data.floorplan.scale ?? 1,
                      opacity: data.floorplan.opacity ?? 0.5,
                  }
                : null,
            staircaseOpenings: data.staircaseOpenings ?? {},
            modelTheme: data.modelTheme ?? { ...defaultModelThemeLight },
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
            selectedStaircaseId: null,
            hoveredWallId: null,
            hoveredCornerId: null,
            drawingFromCornerId: null,
            drawingCursor: null,
            history: [],
            historyIndex: -1,
            loading: false,
        });
        // Trigger room detection after hydrating, then attach persisted room components
        queueMicrotask(() => {
            const store = useFloorplanStore.getState();
            store.detectRooms();

            // Attach persisted room components by polygon hash
            const loadedRoomComponents = data.roomComponents;
            if (loadedRoomComponents && loadedRoomComponents.length > 0) {
                const currentRooms = useFloorplanStore.getState().rooms;
                const updatedRooms = { ...currentRooms };
                // Build lookup: roomKey → components
                const componentsByKey: Record<string, typeof loadedRoomComponents> = {};
                for (const rc of loadedRoomComponents) {
                    if (!componentsByKey[rc.roomKey]) componentsByKey[rc.roomKey] = [];
                    componentsByKey[rc.roomKey].push(rc);
                }
                for (const room of Object.values(updatedRooms)) {
                    const key = [...room.cornerIds].sort().join(",");
                    const matched = componentsByKey[key];
                    if (matched) {
                        updatedRooms[room.id] = {
                            ...room,
                            components: matched.map((rc) => rc.component),
                        };
                    }
                }
                set({ rooms: updatedRooms });
            }
        });
    },

    newPlan: () => {
        const state = get();
        // Revoke any existing floorplan blob URL
        if (state.floorplan?.url?.startsWith("blob:")) {
            URL.revokeObjectURL(state.floorplan.url);
        }
        const defaultFloor = createDefaultFloor();
        set({
            currentPlanId: null,
            currentPlanName: "Untitled Plan",
            floors: [defaultFloor],
            currentFloorId: defaultFloor.id,
            corners: {},
            walls: {},
            rooms: {},
            floorplan: null,
            staircaseOpenings: {},
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
            selectedStaircaseId: null,
            hoveredWallId: null,
            hoveredCornerId: null,
            drawingFromCornerId: null,
            drawingCursor: null,
            modelTheme: { ...defaultModelThemeLight },
            history: [],
            historyIndex: -1,
            mode: "build",
            activeTool: "wall",
        });
    },

    setCurrentPlanName: (name) => {
        set({ currentPlanName: name });
    },
}));

// ── Auto-detect rooms whenever walls or corners change ────────────────────────
let prevWalls = useFloorplanStore.getState().walls;
let prevCorners = useFloorplanStore.getState().corners;

useFloorplanStore.subscribe((state) => {
    if (state.walls !== prevWalls || state.corners !== prevCorners) {
        prevWalls = state.walls;
        prevCorners = state.corners;
        // Defer to avoid triggering set() inside subscribe synchronously
        queueMicrotask(() => {
            useFloorplanStore.getState().detectRooms();
        });
    }
});
