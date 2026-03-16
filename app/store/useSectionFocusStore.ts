import { create } from "zustand";

interface SectionFocusState {
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

