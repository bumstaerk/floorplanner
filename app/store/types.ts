// ─── Geometry primitives ───────────────────────────────────────────────────────

/** A 2D point in meters on the floorplan plane (Y-up in 3D → x/z in world) */
export interface Point2D {
    x: number;
    y: number;
}

// ─── Wall model ────────────────────────────────────────────────────────────────

export type WallFaceSide = "left" | "right";

/**
 * An opening (door / window / arbitrary hole) punched into one face of a wall.
 * `offset` = distance along the wall from `start` (meters).
 * `elevation` = distance from floor to bottom of opening (meters).
 */
export interface WallOpening {
    id: string;
    type: "door" | "window" | "hole";
    /** Distance along the wall from the start point (meters) */
    offset: number;
    /** Width of the opening (meters) */
    width: number;
    /** Height of the opening (meters) */
    height: number;
    /** Distance from the floor to the bottom edge (meters) */
    elevation: number;
    /** Which face the opening belongs to */
    face: WallFaceSide;
}

/**
 * A component attached to a wall face (light, sensor, switch, etc.)
 * Position is given relative to the wall segment.
 */
export interface WallComponent {
    id: string;
    type: string; // e.g. "light", "sensor", "switch", "outlet", …
    label: string;
    /** Distance along the wall from the start point (meters) */
    offset: number;
    /** Height from the floor (meters) */
    elevation: number;
    /** Which face the component is on */
    face: WallFaceSide;
    /** Arbitrary metadata for the component type */
    meta?: Record<string, unknown>;
}

/**
 * A single wall segment between two nodes (corners).
 * Walls reference corner IDs so multiple walls can share a corner.
 *
 * `thickness` and `height` are nullable: when `null` the wall inherits
 * from the plan-level defaults (`defaultWallThickness` / `defaultWallHeight`).
 * Use the store helpers `getResolvedWallThickness` / `getResolvedWallHeight`
 * to obtain the effective value.
 */
export interface WallSegment {
    id: string;
    /** ID of the start corner node */
    startId: string;
    /** ID of the end corner node */
    endId: string;
    /** Wall thickness in meters, or `null` to use plan default */
    thickness: number | null;
    /** Wall height in meters, or `null` to use plan default */
    height: number | null;
    /**
     * Whether the wall is physically visible (rendered as solid geometry).
     * When `false` the wall is invisible but still acts as a room divider
     * in the graph — rooms on each side are detected as separate spaces.
     * Default: `true`.
     */
    visible: boolean;
    /** Openings punched into this wall */
    openings: WallOpening[];
    /** Components attached to this wall */
    components: WallComponent[];
}

// ─── Rooms ─────────────────────────────────────────────────────────────────────

/**
 * A room is a closed polygon formed by a cycle of walls/corners.
 * Detected automatically when walls form a closed loop.
 */
export interface Room {
    id: string;
    /** User-assigned name for the room (e.g. "Living Room", "Kitchen") */
    name: string;
    /** Ordered list of corner IDs forming the room polygon (closed cycle) */
    cornerIds: string[];
    /** Wall IDs forming the room boundary */
    wallIds: string[];
    /** Centroid of the room polygon (for label placement) */
    center: Point2D;
    /** Area of the room in square meters */
    area: number;
}

// ─── Corner nodes ──────────────────────────────────────────────────────────────

/** A shared corner / junction point referenced by one or more WallSegments */
export interface CornerNode {
    id: string;
    position: Point2D;
}

// ─── Floorplan image ───────────────────────────────────────────────────────────

export interface FloorplanImage {
    /** Object URL or data URL of the uploaded image */
    url: string;
    /** Original file name */
    name: string;
    /** Real-world width in meters (user-configurable for scaling) */
    widthMeters: number;
    /** Real-world height in meters */
    heightMeters: number;
    /** Uniform scale multiplier (default 1.0). Multiplies widthMeters/heightMeters when rendering. */
    scale: number;
    /** Opacity when rendering (0-1) */
    opacity: number;
}

// ─── Editor state ──────────────────────────────────────────────────────────────

export type EditorMode = "build" | "preview";

export type BuildTool = "select" | "wall" | "pan";

/** Snap settings */
export interface SnapSettings {
    enabled: boolean;
    /** Grid size in meters */
    gridSize: number;
    /** Snap to existing corners within this radius (meters) */
    cornerSnapRadius: number;
    /** Snap to angle multiples (degrees), e.g. 45 */
    angleSnap: number;
}

/** Grid display settings */
export interface GridSettings {
    visible: boolean;
    size: number; // total grid extent in meters
    divisions: number;
}

// ─── History (undo/redo) ───────────────────────────────────────────────────────

export interface HistoryEntry {
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
}

// ─── Store shape ───────────────────────────────────────────────────────────────

export interface FloorplanState {
    // ── Data ──
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
    rooms: Record<string, Room>;
    floorplan: FloorplanImage | null;

    // ── Plan persistence ──
    currentPlanId: string | null;
    currentPlanName: string;
    saving: boolean;
    loading: boolean;

    // ── Editor ──
    mode: EditorMode;
    activeTool: BuildTool;
    selectedWallId: string | null;
    selectedCornerId: string | null;
    selectedRoomId: string | null;
    hoveredWallId: string | null;
    hoveredCornerId: string | null;

    /** The corner id where a wall-draw operation started (null = not drawing) */
    drawingFromCornerId: string | null;
    /** Live cursor position while drawing (world coords) */
    drawingCursor: Point2D | null;

    // ── Settings ──
    snap: SnapSettings;
    grid: GridSettings;
    defaultWallThickness: number;
    defaultWallHeight: number;

    // ── History ──
    history: HistoryEntry[];
    historyIndex: number;

    // ── Actions: mode / tool ──
    setMode: (mode: EditorMode) => void;
    setActiveTool: (tool: BuildTool) => void;

    // ── Actions: rooms ──
    /** Re-detect all rooms from the current wall/corner graph */
    detectRooms: () => void;
    /** Update a room's editable properties (name) */
    updateRoom: (id: string, patch: Partial<Pick<Room, "name">>) => void;
    /** Select a room by ID */
    selectRoom: (id: string | null) => void;

    // ── Actions: floorplan image ──
    setFloorplan: (image: FloorplanImage) => void;
    updateFloorplan: (patch: Partial<FloorplanImage>) => void;
    removeFloorplan: () => void;

    // ── Actions: corners ──
    addCorner: (position: Point2D) => string;
    moveCorner: (id: string, position: Point2D) => void;
    removeCorner: (id: string) => void;

    // ── Actions: walls ──
    addWall: (startId: string, endId: string) => string;
    removeWall: (id: string) => void;
    updateWall: (
        id: string,
        patch: Partial<Pick<WallSegment, "thickness" | "height" | "visible">>,
    ) => void;

    // ── Helpers: resolved wall dimensions ──
    /** Get the effective thickness of a wall (own value or plan default) */
    getResolvedWallThickness: (wallId: string) => number;
    /** Get the effective height of a wall (own value or plan default) */
    getResolvedWallHeight: (wallId: string) => number;

    // ── Actions: openings ──
    addOpening: (wallId: string, opening: Omit<WallOpening, "id">) => string;
    removeOpening: (wallId: string, openingId: string) => void;
    updateOpening: (
        wallId: string,
        openingId: string,
        patch: Partial<Omit<WallOpening, "id">>,
    ) => void;

    // ── Actions: components ──
    addComponent: (
        wallId: string,
        component: Omit<WallComponent, "id">,
    ) => string;
    removeComponent: (wallId: string, componentId: string) => void;
    updateComponent: (
        wallId: string,
        componentId: string,
        patch: Partial<Omit<WallComponent, "id">>,
    ) => void;

    // ── Actions: drawing ──
    startDrawing: (cornerId: string) => void;
    updateDrawingCursor: (cursor: Point2D | null) => void;
    finishDrawing: (cornerId: string) => void;
    cancelDrawing: () => void;

    // ── Actions: selection / hover ──
    selectWall: (id: string | null) => void;
    selectCorner: (id: string | null) => void;
    setHoveredWall: (id: string | null) => void;
    setHoveredCorner: (id: string | null) => void;

    // ── Actions: snap & grid ──
    updateSnap: (patch: Partial<SnapSettings>) => void;
    updateGrid: (patch: Partial<GridSettings>) => void;
    setDefaultWallThickness: (v: number) => void;
    setDefaultWallHeight: (v: number) => void;

    // ── Actions: history ──
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;

    // ── Helpers ──
    /** Find the nearest existing corner within snap radius, or null */
    findSnapCorner: (position: Point2D) => CornerNode | null;
    /** Snap a position to the grid */
    snapToGrid: (position: Point2D) => Point2D;
    /** Get all wall IDs connected to a corner */
    getWallsAtCorner: (cornerId: string) => string[];
    /** Calculate wall length in meters */
    getWallLength: (wallId: string) => number;

    /** Split a wall at a given position, inserting a new corner and creating two wall segments */
    splitWall: (wallId: string, position: Point2D) => string;

    /** Find the nearest wall to a given point (within tolerance). Returns the wall ID and projected point, or null. */
    findWallAtPoint: (
        position: Point2D,
    ) => { wallId: string; point: Point2D } | null;

    // ── Actions: plan persistence ──
    /** Save the current plan to the server (creates or updates) */
    savePlan: (name?: string) => Promise<void>;
    /** Load a plan from the server by ID */
    loadPlan: (id: string) => Promise<void>;
    /** Hydrate the store directly from pre-loaded plan data (no fetch) */
    hydratePlan: (data: {
        id: string;
        name: string;
        defaultWallThickness: number;
        defaultWallHeight: number;
        corners: Record<string, CornerNode>;
        walls: Record<string, WallSegment>;
        floorplan: FloorplanImage | null;
    }) => void;
    /** Reset the editor to a blank state */
    newPlan: () => void;
    /** Update the current plan name without saving */
    setCurrentPlanName: (name: string) => void;
}
