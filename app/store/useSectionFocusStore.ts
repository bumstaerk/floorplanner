import { create } from "zustand";

/**
 * Interaction state for floor/section focus in the 3D preview.
 *
 * Manages hover and active (click) states for floors, plus a per-frame
 * set of wall IDs that face the camera (updated imperatively from useFrame).
 */
export interface SectionFocusState {
  hoveredFloorId: string | null;
  activeFloorId: string | null;
  /** Wall IDs whose surface normals face the camera (updated per-frame) */
  cameraFacingWallIds: Set<string>;

  setHoveredFloor: (id: string | null) => void;
  setActiveFloor: (id: string | null) => void;
  clearActive: () => void;
  setCameraFacingWallIds: (ids: Set<string>) => void;
}

export const useSectionFocusStore = create<SectionFocusState>((set, get) => ({
  hoveredFloorId: null,
  activeFloorId: null,
  cameraFacingWallIds: new Set(),

  setHoveredFloor: (id) => {
    // Don't update hover if there's an active section
    const { activeFloorId } = get();
    if (activeFloorId !== null) return;
    set({ hoveredFloorId: id });
  },

  setActiveFloor: (id) =>
    set({ activeFloorId: id, hoveredFloorId: null }),

  clearActive: () =>
    set({
      activeFloorId: null,
      hoveredFloorId: null,
      cameraFacingWallIds: new Set(),
    }),

  setCameraFacingWallIds: (ids) => set({ cameraFacingWallIds: ids }),
}));

// ── Derived helpers ─────────────────────────────────────────────────────────

/** The floor that currently has focus (active takes precedence over hovered) */
export function getFocusedFloorId(state: SectionFocusState): string | null {
  return state.activeFloorId ?? state.hoveredFloorId;
}

/** Target opacity for a given floor based on current focus state */
export function getFloorTargetOpacity(
  floorId: string,
  state: SectionFocusState,
): number {
  const focused = getFocusedFloorId(state);
  if (focused === null) return 1;
  return floorId === focused ? 1 : 0.25;
}
