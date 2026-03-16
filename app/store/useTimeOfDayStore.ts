import { create } from "zustand";

interface TimeOfDayState {
  /** Hour of day (0–24, fractional). 12.0 = noon, 0 = midnight */
  timeOfDay: number;
  /** Whether the day/night cycle lighting is active */
  enabled: boolean;
  setTimeOfDay: (t: number) => void;
  setEnabled: (v: boolean) => void;
}

export const useTimeOfDayStore = create<TimeOfDayState>((set) => ({
  timeOfDay: 14, // default to early afternoon
  enabled: false,
  setTimeOfDay: (t) => set({ timeOfDay: Math.max(0, Math.min(24, t)) }),
  setEnabled: (v) => set({ enabled: v }),
}));
