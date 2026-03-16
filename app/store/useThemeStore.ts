import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const STORAGE_KEY = "floorplanner-theme";

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "dark";
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch {
        // localStorage might be unavailable
    }
    return "dark";
}

function applyThemeClass(theme: Theme) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
}

function persistTheme(theme: Theme) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // localStorage might be unavailable
    }
}

export const useThemeStore = create<ThemeState>((set) => {
    // Apply on store creation (client-side only)
    const initial = getInitialTheme();
    applyThemeClass(initial);

    return {
        theme: initial,

        setTheme: (theme) => {
            applyThemeClass(theme);
            persistTheme(theme);
            set({ theme });
        },

        toggleTheme: () => {
            set((state) => {
                const next: Theme = state.theme === "dark" ? "light" : "dark";
                applyThemeClass(next);
                persistTheme(next);
                return { theme: next };
            });
        },
    };
});
