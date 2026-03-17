import { useCallback, useRef, useState, useEffect } from "react";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useThemeStore } from "../store/useThemeStore";
import { useShallow } from "zustand/react/shallow";
import type { BuildTool, EditorMode } from "../store/types";

/**
 * Main toolbar overlay rendered on top of the 3D canvas.
 *
 * Contains:
 * - Mode switcher (Build 2D / Preview 3D)
 * - Tool selector (Select / Wall / Pan) — only in build mode
 * - Floorplan upload button
 * - Undo / Redo buttons
 * - Snap toggle
 * - Grid toggle
 * - Save / Load / New plan buttons
 * - Load plan dialog
 */

interface SavedPlan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export function Toolbar() {
  const mode = useFloorplanStore((s) => s.mode);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const snap = useFloorplanStore((s) => s.snap);
  const grid = useFloorplanStore((s) => s.grid);
  const floorplan = useFloorplanStore((s) => s.floorplans[s.currentFloorId] ?? null);
  const drawingFromCornerId = useFloorplanStore((s) => s.drawingFromCornerId);
  const historyIndex = useFloorplanStore((s) => s.historyIndex);
  const historyLength = useFloorplanStore((s) => s.history.length);
  const currentPlanId = useFloorplanStore((s) => s.currentPlanId);
  const currentPlanName = useFloorplanStore((s) => s.currentPlanName);
  const saving = useFloorplanStore((s) => s.saving);
  const loading = useFloorplanStore((s) => s.loading);

  const floors = useFloorplanStore(useShallow((s) => s.floors));
  const currentFloorId = useFloorplanStore((s) => s.currentFloorId);
  const addFloor = useFloorplanStore((s) => s.addFloor);
  const removeFloor = useFloorplanStore((s) => s.removeFloor);
  const setCurrentFloor = useFloorplanStore((s) => s.setCurrentFloor);

  const setMode = useFloorplanStore((s) => s.setMode);
  const setActiveTool = useFloorplanStore((s) => s.setActiveTool);
  const setFloorplan = useFloorplanStore((s) => s.setFloorplan);
  const removeFloorplan = useFloorplanStore((s) => s.removeFloorplan);
  const updateSnap = useFloorplanStore((s) => s.updateSnap);
  const updateGrid = useFloorplanStore((s) => s.updateGrid);
  const cancelDrawing = useFloorplanStore((s) => s.cancelDrawing);
  const undo = useFloorplanStore((s) => s.undo);
  const redo = useFloorplanStore((s) => s.redo);
  const savePlan = useFloorplanStore((s) => s.savePlan);
  const loadPlan = useFloorplanStore((s) => s.loadPlan);
  const newPlan = useFloorplanStore((s) => s.newPlan);
  const setCurrentPlanName = useFloorplanStore((s) => s.setCurrentPlanName);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < historyLength - 2;

  // ── Load dialog state ───────────────────────────────────────────────────────

  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // ── Save name dialog state ──────────────────────────────────────────────────

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveNameValue, setSaveNameValue] = useState("");

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        setSavedPlans(data);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const handleOpenLoadDialog = useCallback(() => {
    setShowLoadDialog(true);
    fetchPlans();
  }, [fetchPlans]);

  const handleLoadPlan = useCallback(
    async (id: string) => {
      await loadPlan(id);
      setShowLoadDialog(false);
    },
    [loadPlan],
  );

  const handleDeletePlan = useCallback(async (id: string) => {
    setDeletingPlanId(id);
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedPlans((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete plan:", err);
    } finally {
      setDeletingPlanId(null);
    }
  }, []);

  // ── Save handler ────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (currentPlanId) {
      // Already saved before — just save with current name
      savePlan();
    } else {
      // First save — prompt for a name
      setSaveNameValue(currentPlanName || "Untitled Plan");
      setShowSaveDialog(true);
    }
  }, [currentPlanId, currentPlanName, savePlan]);

  const handleSaveAs = useCallback(() => {
    setSaveNameValue(currentPlanName || "Untitled Plan");
    setShowSaveDialog(true);
  }, [currentPlanName]);

  const handleSaveDialogConfirm = useCallback(() => {
    const name = saveNameValue.trim() || "Untitled Plan";
    setCurrentPlanName(name);
    savePlan(name);
    setShowSaveDialog(false);
  }, [saveNameValue, setCurrentPlanName, savePlan]);

  // ── Floorplan upload ────────────────────────────────────────────────────────

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);

      // Read image dimensions to compute aspect ratio
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        // Default: assume the longest side is 20 meters (user can rescale later)
        const maxMeters = 20;
        const widthMeters = aspect >= 1 ? maxMeters : maxMeters * aspect;
        const heightMeters = aspect >= 1 ? maxMeters / aspect : maxMeters;

        setFloorplan({
          floorId: "", // will be set by store to currentFloorId
          url,
          name: file.name,
          widthMeters,
          heightMeters,
          opacity: 0.5,
          scale: 1,
        });
      };
      img.src = url;

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [setFloorplan],
  );

  // ── Mode switching ──────────────────────────────────────────────────────────

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      setMode(newMode);
    },
    [setMode],
  );

  // ── Tool switching ──────────────────────────────────────────────────────────

  const handleToolChange = useCallback(
    (tool: BuildTool) => {
      if (drawingFromCornerId && tool !== "wall") {
        cancelDrawing();
      }
      setActiveTool(tool);
    },
    [setActiveTool, drawingFromCornerId, cancelDrawing],
  );

  // ── Close dialogs on Escape ─────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLoadDialog) setShowLoadDialog(false);
        if (showSaveDialog) setShowSaveDialog(false);
      }
    };
    if (showLoadDialog || showSaveDialog) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showLoadDialog, showSaveDialog]);

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      {/* Theme toggle (floating, top-right corner area) */}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between p-3 gap-3">
        {/* Left group: Mode switcher + Plan controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
            <button
              onClick={() => handleModeChange("build")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                mode === "build"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Build 2D
              </span>
            </button>
            <button
              onClick={() => handleModeChange("preview")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                mode === "preview"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Preview 3D
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

          {/* Plan controls: New / Save / Load */}
          <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
            <ToolButton active={false} onClick={newPlan} title="New Plan">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </ToolButton>
            <ToolButton
              active={false}
              onClick={handleSave}
              title={
                currentPlanId
                  ? `Save "${currentPlanName}" (Ctrl+S)`
                  : "Save Plan (Ctrl+S)"
              }
              disabled={saving}
            >
              {saving ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
              )}
            </ToolButton>
            <ToolButton
              active={false}
              onClick={handleOpenLoadDialog}
              title="Load Plan"
              disabled={loading}
            >
              {loading ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              )}
            </ToolButton>
          </div>

          {/* Current plan name */}
          {currentPlanId && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded px-2 py-1 border border-gray-300/50 dark:border-gray-700/50 truncate max-w-40">
              {currentPlanName}
            </span>
          )}
        </div>

        {/* Center group: Build tools (only in build mode) */}
        {mode === "build" && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
              <ToolButton
                active={activeTool === "select"}
                onClick={() => handleToolChange("select")}
                title="Select (V)"
                shortcut="V"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={activeTool === "wall"}
                onClick={() => handleToolChange("wall")}
                title="Draw Wall (W)"
                shortcut="W"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={activeTool === "pan"}
                onClick={() => handleToolChange("pan")}
                title="Pan (H)"
                shortcut="H"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={activeTool === "staircase"}
                onClick={() => handleToolChange("staircase")}
                title="Place Stairs (T)"
                shortcut="T"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 21h4V17h4v-4h4V9h4V5h2"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={activeTool === "measure"}
                onClick={() => handleToolChange("measure")}
                title="Measure (M)"
                shortcut="M"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 17l1.5-1.5M22 7l-1.5 1.5M2 17l5-5m0 0l1.5 1.5M7 12l3-3m0 0l1.5 1.5M10 9l3-3m0 0l1.5 1.5M13 6l3-3m0 0l1.5 1.5M16 3l6 6M2 17l6 6"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={activeTool === "calibrate"}
                onClick={() => handleToolChange("calibrate")}
                title="Calibrate Scale (K)"
                shortcut="K"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18"
                  />
                </svg>
              </ToolButton>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            {/* Snap toggle */}
            <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
              <ToolButton
                active={snap.enabled}
                onClick={() => updateSnap({ enabled: !snap.enabled })}
                title={`Snap ${snap.enabled ? "On" : "Off"} (S)`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={grid.visible}
                onClick={() => updateGrid({ visible: !grid.visible })}
                title={`Grid ${grid.visible ? "On" : "Off"} (G)`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </ToolButton>
            </div>
          </div>
        )}

        {/* Right group: Floorplan upload + undo/redo */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Undo / Redo */}
          {mode === "build" && (
            <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
              <ToolButton
                active={false}
                onClick={undo}
                title="Undo (Ctrl+Z)"
                disabled={!canUndo}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"
                  />
                </svg>
              </ToolButton>
              <ToolButton
                active={false}
                onClick={redo}
                title="Redo (Ctrl+Shift+Z)"
                disabled={!canRedo}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"
                  />
                </svg>
              </ToolButton>
            </div>
          )}

          {/* Floorplan upload */}
          <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
            {floorplan ? (
              <>
                <ToolButton
                  active={false}
                  onClick={handleUploadClick}
                  title="Replace floorplan"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </ToolButton>
                <ToolButton
                  active={false}
                  onClick={removeFloorplan}
                  title="Remove floorplan"
                >
                  <svg
                    className="w-4 h-4 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </ToolButton>
              </>
            ) : (
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-md transition-all duration-150"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload Floorplan
              </button>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* Floor selector panel (left side, build mode only) */}
      {mode === "build" && (
        <div className="absolute top-16 left-3 z-10 pointer-events-auto">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-300/50 dark:border-gray-700/50 overflow-hidden w-44">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300/50 dark:border-gray-700/50">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Floors
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => addFloor()}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all"
                  title="Add Floor"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => removeFloor(currentFloorId)}
                  disabled={floors.length <= 1}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete Current Floor"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {[...floors]
                .sort((a, b) => b.level - a.level)
                .map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => setCurrentFloor(floor.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-all ${
                      floor.id === currentFloorId
                        ? "bg-blue-600/20 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-200/40 dark:hover:bg-gray-700/40 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{floor.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                        L{floor.level}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Save name dialog ──────────────────────────────────────────── */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-300/50 dark:border-gray-700/50 w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Save Plan
              </h2>
            </div>
            <div className="px-5 py-4">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">
                Plan Name
              </label>
              <input
                type="text"
                value={saveNameValue}
                onChange={(e) => setSaveNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDialogConfirm();
                }}
                placeholder="Untitled Plan"
                autoFocus
                className="w-full bg-gray-100/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-200 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm
                                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200/50 dark:border-gray-700/50">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-md transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDialogConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load dialog ──────────────────────────────────────────────── */}
      {showLoadDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowLoadDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-300/50 dark:border-gray-700/50 w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Load Plan
              </h2>
              <button
                onClick={() => setShowLoadDialog(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loadingPlans && (
                <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <svg
                    className="w-5 h-5 animate-spin mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </div>
              )}

              {!loadingPlans && savedPlans.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                  <svg
                    className="w-10 h-10 mb-3 text-gray-400 dark:text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <p className="text-sm">No saved plans yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                    Save a plan to see it here
                  </p>
                </div>
              )}

              {!loadingPlans &&
                savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between px-5 py-3 hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-200/30 dark:border-gray-700/30 last:border-b-0 ${
                      plan.id === currentPlanId
                        ? "bg-blue-100/30 dark:bg-blue-900/20"
                        : ""
                    }`}
                  >
                    <button
                      onClick={() => handleLoadPlan(plan.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {plan.name}
                        </span>
                        {plan.id === currentPlanId && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-600/30 text-blue-400 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Updated {formatRelativeTime(plan.updatedAt)}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deletingPlanId === plan.id}
                      className="shrink-0 ml-3 w-7 h-7 flex items-center justify-center rounded-md
                                                text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-all
                                                disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete plan"
                    >
                      {deletingPlanId === plan.id ? (
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

// ─── ToolButton ───────────────────────────────────────────────────────────────

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  shortcut?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolButton({
  active,
  onClick,
  title,
  shortcut,
  disabled = false,
  children,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        relative px-3 py-2 rounded-md text-sm font-medium transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${
          active
            ? "bg-blue-600 text-white shadow-md"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
        }
      `}
    >
      {children}
      {shortcut && (
        <span className="absolute -bottom-0.5 right-0.5 text-[9px] text-gray-400 dark:text-gray-500 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <div className="flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-300/50 dark:border-gray-700/50">
      <button
        onClick={toggleTheme}
        title={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
        className="relative px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
      >
        {theme === "dark" ? (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
