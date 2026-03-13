import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type {
    FloorplanState,
    CornerNode,
    WallSegment,
    WallOpening,
    WallComponent,
    FloorplanImage,
    Point2D,
    HistoryEntry,
} from "./types";
import { detectRooms } from "./roomDetection";

const DEFAULT_WALL_THICKNESS = 0.4; // meters
const DEFAULT_WALL_HEIGHT = 2.2; // meters

function makeHistoryEntry(
    corners: Record<string, CornerNode>,
    walls: Record<string, WallSegment>,
): HistoryEntry {
    return {
        corners: JSON.parse(JSON.stringify(corners)),
        walls: JSON.parse(JSON.stringify(walls)),
    };
}

function distance(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export const useFloorplanStore = create<FloorplanState>((set, get) => ({
    // ── Data ──────────────────────────────────────────────────────────────────
    corners: {},
    walls: {},
    rooms: {},
    floorplan: null,

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

    // ── History ───────────────────────────────────────────────────────────────
    history: [],
    historyIndex: -1,

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
    setFloorplan: (image: FloorplanImage) => set(() => ({ floorplan: image })),

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
                [id]: { id, position: { ...position } },
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
        // Don't allow duplicate walls between the same two corners
        const existing = Object.values(state.walls).find(
            (w) =>
                (w.startId === startId && w.endId === endId) ||
                (w.startId === endId && w.endId === startId),
        );
        if (existing) return existing.id;

        const id = uuid();
        set((s) => ({
            walls: {
                ...s.walls,
                [id]: {
                    id,
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
        })),

    selectCorner: (id) =>
        set(() => ({
            selectedCornerId: id,
            selectedWallId: null,
            selectedRoomId: null,
        })),

    setHoveredWall: (id) => set(() => ({ hoveredWallId: id })),
    setHoveredCorner: (id) => set(() => ({ hoveredCornerId: id })),

    // ── Actions: snap & grid ──────────────────────────────────────────────────
    updateSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),

    updateGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),

    setDefaultWallThickness: (v) => set(() => ({ defaultWallThickness: v })),
    setDefaultWallHeight: (v) => set(() => ({ defaultWallHeight: v })),

    // ── Actions: history ──────────────────────────────────────────────────────
    pushHistory: () =>
        set((s) => {
            const entry = makeHistoryEntry(s.corners, s.walls);
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
                historyIndex: s.historyIndex - 1,
                selectedWallId: null,
                selectedCornerId: null,
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
                historyIndex: nextIndex - 1,
                selectedWallId: null,
                selectedCornerId: null,
            };
        }),

    // ── Helpers ───────────────────────────────────────────────────────────────
    findSnapCorner: (position) => {
        const state = get();
        if (!state.snap.enabled) return null;
        let nearest: CornerNode | null = null;
        let nearestDist = Infinity;
        for (const corner of Object.values(state.corners)) {
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
            .filter((w) => w.startId === cornerId || w.endId === cornerId)
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
                    corners: state.corners,
                    walls: state.walls,
                    floorplan: floorplanPayload,
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
            set({
                currentPlanId: data.id,
                currentPlanName: data.name,
                defaultWallThickness:
                    data.defaultWallThickness ?? DEFAULT_WALL_THICKNESS,
                defaultWallHeight:
                    data.defaultWallHeight ?? DEFAULT_WALL_HEIGHT,
                corners: data.corners ?? {},
                walls: data.walls ?? {},
                rooms: {},
                floorplan: data.floorplan
                    ? {
                          url: data.floorplan.url,
                          name: data.floorplan.name,
                          widthMeters: data.floorplan.widthMeters,
                          heightMeters: data.floorplan.heightMeters,
                          scale: data.floorplan.scale ?? 1,
                          opacity: data.floorplan.opacity ?? 0.5,
                      }
                    : null,
                selectedWallId: null,
                selectedCornerId: null,
                selectedRoomId: null,
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
        set({
            currentPlanId: data.id,
            currentPlanName: data.name,
            defaultWallThickness:
                data.defaultWallThickness ?? DEFAULT_WALL_THICKNESS,
            defaultWallHeight: data.defaultWallHeight ?? DEFAULT_WALL_HEIGHT,
            corners: data.corners ?? {},
            walls: data.walls ?? {},
            rooms: {},
            floorplan: data.floorplan
                ? {
                      url: data.floorplan.url,
                      name: data.floorplan.name,
                      widthMeters: data.floorplan.widthMeters,
                      heightMeters: data.floorplan.heightMeters,
                      scale: data.floorplan.scale ?? 1,
                      opacity: data.floorplan.opacity ?? 0.5,
                  }
                : null,
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
            hoveredWallId: null,
            hoveredCornerId: null,
            drawingFromCornerId: null,
            drawingCursor: null,
            history: [],
            historyIndex: -1,
            loading: false,
        });
        // Trigger room detection after hydrating
        queueMicrotask(() => {
            useFloorplanStore.getState().detectRooms();
        });
    },

    newPlan: () => {
        const state = get();
        // Revoke any existing floorplan blob URL
        if (state.floorplan?.url?.startsWith("blob:")) {
            URL.revokeObjectURL(state.floorplan.url);
        }
        set({
            currentPlanId: null,
            currentPlanName: "Untitled Plan",
            corners: {},
            walls: {},
            rooms: {},
            floorplan: null,
            selectedWallId: null,
            selectedCornerId: null,
            selectedRoomId: null,
            hoveredWallId: null,
            hoveredCornerId: null,
            drawingFromCornerId: null,
            drawingCursor: null,
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
