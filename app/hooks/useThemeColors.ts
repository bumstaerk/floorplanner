import { useMemo } from "react";
import { useThemeStore } from "../store/useThemeStore";

export interface ThemeColors {
    // ── Canvas ──
    canvasBg: string;

    // ── Grid ──
    gridMajor: string;
    gridMinor: string;

    // ── Wall 2D ──
    wallFillDefault: string;
    wallFillHovered: string;
    wallFillSelected: string;
    wallFillInvisible: string;
    wallFillInvisibleHovered: string;
    wallFillInvisibleSelected: string;
    wallOutlineDefault: string;
    wallOutlineHovered: string;
    wallOutlineSelected: string;
    wallOutlineInvisible: string;
    wallOutlineInvisibleHovered: string;
    wallOutlineInvisibleSelected: string;
    wallLabelDefault: string;
    wallLabelSelected: string;
    wallCenterLine: string;
    wallInvisibleBadge: string;
    wallDimensionLabel: string;
    wallDimensionLabelInvisible: string;
    textOutline: string;

    // ── Corner 2D ──
    cornerDefault: string;
    cornerHovered: string;
    cornerSelected: string;
    cornerDrawing: string;
    cornerRingDefault: string;
    cornerRingHovered: string;
    cornerRingSelected: string;
    cornerRingDrawing: string;
    cornerDrawingPulse: string;

    // ── Room 2D ──
    roomFillDefault: string;
    roomFillSelected: string;
    roomLabelDefault: string;
    roomLabelSelected: string;

    // ── Room 3D ──
    room3dFill: string;
    room3dLabel: string;
    room3dArea: string;
    room3dOutline: string;

    // ── Drawing line ──
    drawingLine: string;
    drawingCursorFill: string;
    drawingCursorRing: string;
    drawingLabelBg: string;

    // ── Opening 2D (door/window/hole) ──
    openingDefault: string;
    openingSelected: string;
    openingPaneDefault: string;
    openingPaneSelected: string;
    /** Color used to "erase" wall fill behind openings */
    openingGap: string;

    // ── Staircase 2D ──
    staircaseDefault: string;
    staircaseSelected: string;

    // ── Wall 3D ──
    wall3dDefault: string;
    wall3dSelected: string;
    wall3dWireframe: string;
    wall3dEdge: string;
    wall3dGlass: string;
    wall3dWindowFrame: string;
    wall3dDoorFrame: string;

    // ── Components (wall + room) ──
    componentLight: string;
    componentSensor: string;
    componentOutlet: string;
    componentSwitch: string;

    // ── Preview scene ──
    groundPlane: string;
    floorPlate: string;
    fog: string;
    hemisphereTop: string;
    hemisphereBottom: string;
}

const darkColors: ThemeColors = {
    // Canvas
    canvasBg: "#0f172a",

    // Grid
    gridMajor: "#334155",
    gridMinor: "#1e293b",

    // Wall 2D
    wallFillDefault: "#475569",
    wallFillHovered: "#60a5fa",
    wallFillSelected: "#3b82f6",
    wallFillInvisible: "#334155",
    wallFillInvisibleHovered: "#818cf8",
    wallFillInvisibleSelected: "#6366f1",
    wallOutlineDefault: "#1e293b",
    wallOutlineHovered: "#3b82f6",
    wallOutlineSelected: "#1d4ed8",
    wallOutlineInvisible: "#475569",
    wallOutlineInvisibleHovered: "#818cf8",
    wallOutlineInvisibleSelected: "#6366f1",
    wallLabelDefault: "#e2e8f0",
    wallLabelSelected: "#ffffff",
    wallCenterLine: "#94a3b8",
    wallInvisibleBadge: "#a5b4fc",
    wallDimensionLabel: "#93c5fd",
    wallDimensionLabelInvisible: "#a5b4fc",
    textOutline: "#000000",

    // Corner 2D
    cornerDefault: "#94a3b8",
    cornerHovered: "#60a5fa",
    cornerSelected: "#3b82f6",
    cornerDrawing: "#f59e0b",
    cornerRingDefault: "#64748b",
    cornerRingHovered: "#3b82f6",
    cornerRingSelected: "#1d4ed8",
    cornerRingDrawing: "#d97706",
    cornerDrawingPulse: "#fbbf24",

    // Room 2D
    roomFillDefault: "#334155",
    roomFillSelected: "#3b82f6",
    roomLabelDefault: "#94a3b8",
    roomLabelSelected: "#93c5fd",

    // Room 3D
    room3dFill: "#334155",
    room3dLabel: "#94a3b8",
    room3dArea: "#64748b",
    room3dOutline: "#0f172a",

    // Drawing line
    drawingLine: "#f59e0b",
    drawingCursorFill: "#f59e0b",
    drawingCursorRing: "#d97706",
    drawingLabelBg: "#1e293b",

    // Opening 2D
    openingDefault: "#e2e8f0",
    openingSelected: "#60a5fa",
    openingPaneDefault: "#94a3b8",
    openingPaneSelected: "#93c5fd",
    openingGap: "#0f172a",

    // Staircase 2D
    staircaseDefault: "#94a3b8",
    staircaseSelected: "#fbbf24",

    // Wall 3D
    wall3dDefault: "#e2e8f0",
    wall3dSelected: "#60a5fa",
    wall3dWireframe: "#3b82f6",
    wall3dEdge: "#94a3b8",
    wall3dGlass: "#88ccff",
    wall3dWindowFrame: "#5a7a9a",
    wall3dDoorFrame: "#8b6f47",

    // Components (wall + room)
    componentLight: "#fbbf24",
    componentSensor: "#22d3ee",
    componentOutlet: "#4ade80",
    componentSwitch: "#fb923c",

    // Preview scene
    groundPlane: "#1a1a2e",
    floorPlate: "#475569",
    fog: "#0f172a",
    hemisphereTop: "#b1e1ff",
    hemisphereBottom: "#b97a20",
};

const lightColors: ThemeColors = {
    // Canvas
    canvasBg: "#f1f5f9",

    // Grid
    gridMajor: "#cbd5e1",
    gridMinor: "#e2e8f0",

    // Wall 2D
    wallFillDefault: "#94a3b8",
    wallFillHovered: "#60a5fa",
    wallFillSelected: "#3b82f6",
    wallFillInvisible: "#cbd5e1",
    wallFillInvisibleHovered: "#a78bfa",
    wallFillInvisibleSelected: "#7c3aed",
    wallOutlineDefault: "#64748b",
    wallOutlineHovered: "#3b82f6",
    wallOutlineSelected: "#1d4ed8",
    wallOutlineInvisible: "#94a3b8",
    wallOutlineInvisibleHovered: "#a78bfa",
    wallOutlineInvisibleSelected: "#7c3aed",
    wallLabelDefault: "#1e293b",
    wallLabelSelected: "#1e3a5f",
    wallCenterLine: "#64748b",
    wallInvisibleBadge: "#7c3aed",
    wallDimensionLabel: "#2563eb",
    wallDimensionLabelInvisible: "#7c3aed",
    textOutline: "#ffffff",

    // Corner 2D
    cornerDefault: "#64748b",
    cornerHovered: "#3b82f6",
    cornerSelected: "#2563eb",
    cornerDrawing: "#d97706",
    cornerRingDefault: "#94a3b8",
    cornerRingHovered: "#2563eb",
    cornerRingSelected: "#1d4ed8",
    cornerRingDrawing: "#b45309",
    cornerDrawingPulse: "#f59e0b",

    // Room 2D
    roomFillDefault: "#cbd5e1",
    roomFillSelected: "#93c5fd",
    roomLabelDefault: "#475569",
    roomLabelSelected: "#1d4ed8",

    // Room 3D
    room3dFill: "#cbd5e1",
    room3dLabel: "#475569",
    room3dArea: "#64748b",
    room3dOutline: "#f1f5f9",

    // Drawing line
    drawingLine: "#d97706",
    drawingCursorFill: "#d97706",
    drawingCursorRing: "#b45309",
    drawingLabelBg: "#e2e8f0",

    // Opening 2D
    openingDefault: "#334155",
    openingSelected: "#2563eb",
    openingPaneDefault: "#64748b",
    openingPaneSelected: "#3b82f6",
    openingGap: "#f1f5f9",

    // Staircase 2D
    staircaseDefault: "#64748b",
    staircaseSelected: "#d97706",

    // Wall 3D
    wall3dDefault: "#d1d5db",
    wall3dSelected: "#60a5fa",
    wall3dWireframe: "#3b82f6",
    wall3dEdge: "#6b7280",
    wall3dGlass: "#7dd3fc",
    wall3dWindowFrame: "#4b6a80",
    wall3dDoorFrame: "#78603c",

    // Components (wall + room)
    componentLight: "#d97706",
    componentSensor: "#0891b2",
    componentOutlet: "#16a34a",
    componentSwitch: "#ea580c",

    // Preview scene
    groundPlane: "#e2e8f0",
    floorPlate: "#94a3b8",
    fog: "#f1f5f9",
    hemisphereTop: "#bfdbfe",
    hemisphereBottom: "#d4a96a",
};

/**
 * Returns a memoised palette of hex colours for use in R3F scenes,
 * automatically switching between light and dark variants based on
 * the current theme from `useThemeStore`.
 */
export function useThemeColors(): ThemeColors {
    const theme = useThemeStore((s) => s.theme);
    return useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
}
