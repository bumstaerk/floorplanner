import { create } from "zustand";
import type { HAConnectionStatus, HAEntityState } from "./types";

interface HAStore {
    connectionStatus: HAConnectionStatus;
    states: Record<string, HAEntityState>;
    setSnapshot: (states: Record<string, HAEntityState>) => void;
    applyStateChange: (entityId: string, state: HAEntityState) => void;
    setConnectionStatus: (status: HAConnectionStatus) => void;
}

export const useHAStore = create<HAStore>((set) => ({
    connectionStatus: "disconnected",
    states: {},

    setSnapshot: (states) => set({ states }),

    applyStateChange: (entityId, state) =>
        set((s) => ({ states: { ...s.states, [entityId]: state } })),

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
