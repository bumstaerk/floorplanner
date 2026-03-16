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

// ─── Light state ──────────────────────────────────────────────────────────────

/** Colour mode for a light component */
export type LightColorMode = "warmth" | "rgb";

/**
 * Runtime state for a light component, stored inside the component's `meta`.
 *
 * - `on` / `off` toggle
 * - `brightness` 0–100 %
 * - `colorMode`:
 *     - `"warmth"` — non-RGB lights; `colorTemp` ranges 2700–6500 K
 *     - `"rgb"` — full-colour lights; `rgb` is a hex string like `"#ff8800"`
 */
export interface LightState {
  on: boolean;
  /** Brightness percentage 0–100 */
  brightness: number;
  colorMode: LightColorMode;
  /** Colour temperature in Kelvin (2700–6500). Only used when colorMode = "warmth". */
  colorTemp: number;
  /** Hex RGB colour string. Only used when colorMode = "rgb". */
  rgb: string;
}

/** Default light state for newly created light components */
export const defaultLightState: LightState = {
  on: true,
  brightness: 100,
  colorMode: "warmth",
  colorTemp: 3000,
  rgb: "#ffeedd",
};

/** Extract a LightState from a component's meta, falling back to defaults. */
export function getLightState(meta?: Record<string, unknown>): LightState {
  if (!meta?.lightState) return { ...defaultLightState };
  const ls = meta.lightState as Partial<LightState>;
  return {
    on: ls.on ?? defaultLightState.on,
    brightness: ls.brightness ?? defaultLightState.brightness,
    colorMode: ls.colorMode ?? defaultLightState.colorMode,
    colorTemp: ls.colorTemp ?? defaultLightState.colorTemp,
    rgb: ls.rgb ?? defaultLightState.rgb,
  };
}

/**
 * Convert a colour temperature (2700–6500 K) to an approximate hex colour.
 * Uses a simplified Planckian locus mapping.
 */
export function colorTempToHex(kelvin: number): string {
  const t = kelvin / 100;
  let r: number, g: number, b: number;

  // Red
  if (t <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Green
  if (t <= 66) {
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  g = Math.max(0, Math.min(255, g));

  // Blue
  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  const toHex = (v: number) =>
    Math.round(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
  /** The floor this wall belongs to */
  floorId: string;
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

// ─── Floors ───────────────────────────────────────────────────────────────────

/** A floor/level within a plan */
export interface Floor {
  id: string;
  /** User-assigned name (e.g. "Ground Floor", "Floor 1") */
  name: string;
  /** Integer level for ordering and 3D stacking (0 = ground, 1 = first floor, -1 = basement) */
  level: number;
  /** Floor-to-floor height in meters (used for 3D stacking offset) */
  floorHeight: number;
}

// ─── Staircase openings ───────────────────────────────────────────────────────

/** A rectangular staircase opening placed on a floor */
export interface StaircaseOpening {
  id: string;
  /** The floor this staircase belongs to */
  floorId: string;
  /** Center position in floorplan coordinates */
  position: Point2D;
  /** Width in meters */
  width: number;
  /** Depth in meters */
  depth: number;
  /** Rotation in radians */
  rotation: number;
}

// ─── Rooms ─────────────────────────────────────────────────────────────────────

/**
 * A component attached to a room's ceiling (light, sensor).
 * Position is given in world coordinates (x, y) within the room polygon.
 */
export interface RoomComponent {
  id: string;
  /** Component type — only "light" and "sensor" are valid for ceiling components */
  type: "light" | "sensor";
  label: string;
  /** World X coordinate within the room */
  x: number;
  /** World Y coordinate within the room */
  y: number;
  /** Arbitrary metadata for the component type */
  meta?: Record<string, unknown>;
}

/**
 * A room is a closed polygon formed by a cycle of walls/corners.
 * Detected automatically when walls form a closed loop.
 */
export interface Room {
  id: string;
  /** The floor this room belongs to */
  floorId: string;
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
  /** Components attached to the room's ceiling */
  components: RoomComponent[];
}

// ─── Corner nodes ──────────────────────────────────────────────────────────────

/** A shared corner / junction point referenced by one or more WallSegments */
export interface CornerNode {
  id: string;
  position: Point2D;
  /** The floor this corner belongs to */
  floorId: string;
}

// ─── Floorplan image ───────────────────────────────────────────────────────────

export interface FloorplanImage {
  /** The floor this image belongs to */
  floorId: string;
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

// ─── Model theme (3D viewer) ────────────────────────────────────────────────────

/**
 * Customisable colour palette for the 3D model viewer.
 * Stored per-plan so each plan can have its own look.
 */
export interface ModelTheme {
  /** Wall surface colour */
  wallColor: string;
  /** Room floor fill colour */
  roomFloorColor: string;
  /** Ground plane colour */
  groundColor: string;
  /** Floor plate colour (between multi-storey floors) */
  floorPlateColor: string;
  /** Window glass tint */
  glassColor: string;
  /** Window frame colour */
  windowFrameColor: string;
  /** Door frame colour */
  doorFrameColor: string;
  /** Scene background colour */
  backgroundColor: string;
}

export const defaultModelThemeLight: ModelTheme = {
  wallColor: "#e0d6c8",
  roomFloorColor: "#d8cfc2",
  groundColor: "#c8bfb0",
  floorPlateColor: "#d0c8ba",
  glassColor: "#c8e6ff",
  windowFrameColor: "#b0b0b0",
  doorFrameColor: "#a0896a",
  backgroundColor: "#d8d2c8",
};

export const defaultModelThemeDark: ModelTheme = {
  wallColor: "#2a2a2a",
  roomFloorColor: "#1e1e1e",
  groundColor: "#141414",
  floorPlateColor: "#333333",
  glassColor: "#1a3a5c",
  windowFrameColor: "#555555",
  doorFrameColor: "#6b5a3e",
  backgroundColor: "#0a0a0a",
};

// ─── Editor state ──────────────────────────────────────────────────────────────

export type EditorMode = "build" | "preview";

export type BuildTool = "select" | "wall" | "pan" | "staircase" | "measure";

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
  staircaseOpenings: Record<string, StaircaseOpening>;
}

// ─── Store shape ───────────────────────────────────────────────────────────────

export interface FloorplanState {
  // ── Data ──
  corners: Record<string, CornerNode>;
  walls: Record<string, WallSegment>;
  rooms: Record<string, Room>;
  floorplan: FloorplanImage | null;

  // ── Floors ──
  floors: Floor[];
  currentFloorId: string;
  staircaseOpenings: Record<string, StaircaseOpening>;

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
  selectedStaircaseId: string | null;
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

  // ── Model theme ──
  modelTheme: ModelTheme;

  // ── History ──
  history: HistoryEntry[];
  historyIndex: number;

  // ── Actions: floors ──
  addFloor: () => string;
  removeFloor: (floorId: string) => void;
  updateFloor: (
    floorId: string,
    patch: Partial<Pick<Floor, "name" | "floorHeight">>,
  ) => void;
  setCurrentFloor: (floorId: string) => void;

  // ── Actions: staircase openings ──
  addStaircaseOpening: (position: Point2D) => string;
  removeStaircaseOpening: (id: string) => void;
  updateStaircaseOpening: (
    id: string,
    patch: Partial<Omit<StaircaseOpening, "id" | "floorId">>,
  ) => void;
  selectStaircaseOpening: (id: string | null) => void;

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

  // ── Actions: room components ──
  /** Add a ceiling component to a room, defaults position to room centroid */
  addRoomComponent: (
    roomId: string,
    component: Omit<RoomComponent, "id">,
  ) => void;
  /** Remove a ceiling component from a room */
  removeRoomComponent: (roomId: string, componentId: string) => void;
  /** Update a ceiling component's properties */
  updateRoomComponent: (
    roomId: string,
    componentId: string,
    patch: Partial<Omit<RoomComponent, "id">>,
  ) => void;

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

  // ── Actions: model theme ──
  updateModelTheme: (patch: Partial<ModelTheme>) => void;
  resetModelTheme: () => void;

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
    floors: Floor[];
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
    floorplan: FloorplanImage | null;
    staircaseOpenings: Record<string, StaircaseOpening>;
    roomComponents?: Array<{
      roomKey: string;
      floorId: string;
      component: RoomComponent;
    }>;
    modelTheme?: ModelTheme | null;
  }) => void;
  /** Reset the editor to a blank state */
  newPlan: () => void;
  /** Update the current plan name without saving */
  setCurrentPlanName: (name: string) => void;
}
