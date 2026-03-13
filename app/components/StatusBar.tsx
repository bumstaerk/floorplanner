import { useFloorplanStore } from "../store/useFloorplanStore";
import { useShallow } from "zustand/react/shallow";

export function StatusBar() {
    const mode = useFloorplanStore((s) => s.mode);
    const activeTool = useFloorplanStore((s) => s.activeTool);
    const drawingFromCornerId = useFloorplanStore((s) => s.drawingFromCornerId);
    const wallCount = useFloorplanStore((s) => Object.keys(s.walls).length);
    const cornerCount = useFloorplanStore((s) => Object.keys(s.corners).length);
    const roomCount = useFloorplanStore((s) => Object.keys(s.rooms).length);
    const floorplan = useFloorplanStore((s) => s.floorplan);
    const floors = useFloorplanStore(useShallow((s) => s.floors));
    const currentFloorId = useFloorplanStore((s) => s.currentFloorId);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 pointer-events-none">
            {/* Left: drawing hint */}
            <div className="text-xs text-gray-400 bg-gray-900/70 backdrop-blur-sm rounded px-3 py-1.5 shadow">
                {mode === "build" &&
                    activeTool === "wall" &&
                    !drawingFromCornerId && (
                        <span>
                            Click to place the first corner of a wall
                        </span>
                    )}
                {mode === "build" &&
                    activeTool === "wall" &&
                    drawingFromCornerId && (
                        <span>
                            Click to place the next corner •{" "}
                            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300 text-[10px]">
                                Esc
                            </kbd>{" "}
                            to cancel •{" "}
                            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300 text-[10px]">
                                Right-click
                            </kbd>{" "}
                            to cancel
                        </span>
                    )}
                {mode === "build" && activeTool === "select" && (
                    <span>
                        Click walls or corners to select •{" "}
                        <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300 text-[10px]">
                            Del
                        </kbd>{" "}
                        to delete
                    </span>
                )}
                {mode === "build" && activeTool === "staircase" && (
                    <span>Click to place staircase opening</span>
                )}
                {mode === "build" && activeTool === "pan" && (
                    <span>Drag to pan • Scroll to zoom</span>
                )}
                {mode === "preview" && (
                    <span>
                        Drag to orbit • Right-drag to pan • Scroll to zoom
                    </span>
                )}
            </div>

            {/* Right: stats */}
            <div className="text-xs text-gray-500 bg-gray-900/70 backdrop-blur-sm rounded px-3 py-1.5 shadow">
                {floors.find((f) => f.id === currentFloorId)?.name ?? "Floor"} • {cornerCount} corners • {wallCount} walls
                {roomCount > 0 && (
                    <span>
                        {" "}
                        • {roomCount} room{roomCount !== 1 ? "s" : ""}
                    </span>
                )}
                {floorplan && <span> • {floorplan.name}</span>}
            </div>
        </div>
    );
}
