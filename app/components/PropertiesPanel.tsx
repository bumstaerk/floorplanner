import { useCallback, useState } from "react";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useShallow } from "zustand/react/shallow";
import type { WallOpening, WallComponent, RoomComponent, FloorplanImage } from "../store/types";

/**
 * Properties panel on the right side of the editor.
 *
 * Displays contextual properties for the current selection (wall, corner, room,
 * floorplan image) and **always** shows the Plan Settings section at the bottom
 * so the user can configure plan-level defaults (wall thickness & height).
 */
export function PropertiesPanel() {
    const selectedWallId = useFloorplanStore((s) => s.selectedWallId);
    const selectedCornerId = useFloorplanStore((s) => s.selectedCornerId);
    const selectedRoomId = useFloorplanStore((s) => s.selectedRoomId);
    const selectedStaircaseId = useFloorplanStore((s) => s.selectedStaircaseId);
    const floorplan = useFloorplanStore((s) => s.floorplan);

    const hasSelection =
        selectedWallId !== null ||
        selectedCornerId !== null ||
        selectedRoomId !== null ||
        selectedStaircaseId !== null;

    return (
        <div className="absolute top-16 right-3 z-10 pointer-events-auto w-72">
            <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden max-h-[calc(100vh-5rem)] overflow-y-auto">
                {/* Selection-specific panels */}
                {selectedWallId && <WallProperties wallId={selectedWallId} />}
                {selectedCornerId && !selectedWallId && (
                    <CornerProperties cornerId={selectedCornerId} />
                )}
                {selectedRoomId && !selectedWallId && !selectedCornerId && (
                    <RoomProperties roomId={selectedRoomId} />
                )}
                {selectedStaircaseId && !selectedWallId && !selectedCornerId && !selectedRoomId && (
                    <StaircaseProperties staircaseId={selectedStaircaseId} />
                )}
                {floorplan &&
                    !hasSelection && <FloorplanProperties />}

                {/* Floor Settings */}
                <FloorProperties />

                {/* Plan Settings — always visible */}
                <PlanSettings />
            </div>
        </div>
    );
}

/** ── Room Properties ─────────────────────────────────────────────────────────── */

function RoomProperties({ roomId }: { roomId: string }) {
    const room = useFloorplanStore((s) => s.rooms[roomId]);
    const corners = useFloorplanStore((s) => s.corners);
    const walls = useFloorplanStore((s) => s.walls);
    const updateRoom = useFloorplanStore((s) => s.updateRoom);
    const selectRoom = useFloorplanStore((s) => s.selectRoom);
    const selectWall = useFloorplanStore((s) => s.selectWall);
    const addRoomComponent = useFloorplanStore((s) => s.addRoomComponent);
    const removeRoomComponent = useFloorplanStore(
        (s) => s.removeRoomComponent,
    );
    const updateRoomComponent = useFloorplanStore(
        (s) => s.updateRoomComponent,
    );
    const pushHistory = useFloorplanStore((s) => s.pushHistory);
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(room?.name ?? "");

    const handleNameSubmit = useCallback(() => {
        if (nameValue.trim()) {
            updateRoom(roomId, { name: nameValue.trim() });
        }
        setEditingName(false);
    }, [roomId, nameValue, updateRoom]);

    const handleNameKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                handleNameSubmit();
            } else if (e.key === "Escape") {
                setNameValue(room?.name ?? "");
                setEditingName(false);
            }
        },
        [handleNameSubmit, room?.name],
    );

    const handleAddCeilingLight = useCallback(() => {
        if (!room) return;
        pushHistory();
        addRoomComponent(roomId, {
            type: "light",
            label: "Ceiling Light",
            x: room.center.x,
            y: room.center.y,
        });
    }, [roomId, room, addRoomComponent, pushHistory]);

    const handleAddCeilingSensor = useCallback(() => {
        if (!room) return;
        pushHistory();
        addRoomComponent(roomId, {
            type: "sensor",
            label: "Ceiling Sensor",
            x: room.center.x,
            y: room.center.y,
        });
    }, [roomId, room, addRoomComponent, pushHistory]);

    const handleRemoveRoomComponent = useCallback(
        (componentId: string) => {
            pushHistory();
            removeRoomComponent(roomId, componentId);
        },
        [roomId, removeRoomComponent, pushHistory],
    );

    const handleUpdateRoomComponent = useCallback(
        (
            componentId: string,
            patch: Partial<Omit<RoomComponent, "id">>,
        ) => {
            pushHistory();
            updateRoomComponent(roomId, componentId, patch);
        },
        [roomId, updateRoomComponent, pushHistory],
    );

    if (!room) return null;

    const wallCount = room.wallIds.length;
    const cornerCount = room.cornerIds.length;

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base">🏠</span>
                    <h3 className="text-sm font-semibold text-gray-200">
                        Room
                    </h3>
                </div>
                <button
                    onClick={() => selectRoom(null)}
                    className="text-gray-400 hover:text-gray-200 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700/50"
                >
                    ✕
                </button>
            </div>

            {/* Room Name */}
            <div className="space-y-2">
                <label className="text-xs text-gray-400 block">Name</label>
                {editingName ? (
                    <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={handleNameSubmit}
                        onKeyDown={handleNameKeyDown}
                        autoFocus
                        className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    />
                ) : (
                    <button
                        onClick={() => {
                            setNameValue(room.name);
                            setEditingName(true);
                        }}
                        className="w-full px-2 py-1.5 text-sm text-left bg-gray-700/50 border border-gray-600/50 rounded-md text-gray-200 hover:bg-gray-700 hover:border-gray-500 transition-colors"
                    >
                        {room.name}
                        <span className="text-gray-500 text-xs ml-2">✎</span>
                    </button>
                )}
            </div>

            {/* Room Area */}
            <div className="mt-3 space-y-2">
                <label className="text-xs text-gray-400 block">Area</label>
                <div className="px-2 py-1.5 text-sm bg-gray-700/30 border border-gray-700 rounded-md text-gray-300">
                    {room.area.toFixed(2)} m²
                </div>
            </div>

            {/* Room Info */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-400 block">Walls</label>
                    <div className="px-2 py-1.5 text-sm bg-gray-700/30 border border-gray-700 rounded-md text-gray-300">
                        {wallCount}
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 block">
                        Corners
                    </label>
                    <div className="px-2 py-1.5 text-sm bg-gray-700/30 border border-gray-700 rounded-md text-gray-300">
                        {cornerCount}
                    </div>
                </div>
            </div>

            {/* Wall list */}
            <div className="mt-3">
                <label className="text-xs text-gray-400 block mb-1">
                    Boundary Walls
                </label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {room.wallIds.map((wid) => {
                        const wall = walls[wid];
                        if (!wall) return null;
                        const startPos = corners[wall.startId]?.position;
                        const endPos = corners[wall.endId]?.position;
                        let length = 0;
                        if (startPos && endPos) {
                            const dx = endPos.x - startPos.x;
                            const dy = endPos.y - startPos.y;
                            length = Math.sqrt(dx * dx + dy * dy);
                        }
                        return (
                            <button
                                key={wid}
                                onClick={() => selectWall(wid)}
                                className="w-full flex items-center justify-between px-2 py-1 text-xs bg-gray-700/30 border border-gray-700 rounded hover:bg-gray-700/60 hover:border-gray-600 transition-colors"
                            >
                                <span className="text-gray-300 truncate">
                                    Wall {wid.slice(0, 6)}…
                                </span>
                                <span className="text-gray-500 ml-1">
                                    {length.toFixed(2)}m
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Ceiling Components */}
            <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">
                        Ceiling Components ({room.components.length})
                    </label>
                    <div className="flex gap-1">
                        <SmallButton
                            onClick={handleAddCeilingLight}
                            title="Add ceiling light"
                        >
                            💡
                        </SmallButton>
                        <SmallButton
                            onClick={handleAddCeilingSensor}
                            title="Add ceiling sensor"
                        >
                            📡
                        </SmallButton>
                    </div>
                </div>

                {room.components.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                        No ceiling components
                    </p>
                )}

                {room.components.map((comp) => (
                    <div
                        key={comp.id}
                        className="bg-gray-700/30 rounded-lg p-2.5 space-y-2 mt-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-200 capitalize">
                                {getComponentIcon(comp.type)} {comp.label}
                            </span>
                            <button
                                onClick={() =>
                                    handleRemoveRoomComponent(comp.id)
                                }
                                className="text-gray-500 hover:text-red-400 transition-colors"
                                title="Remove component"
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
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <NumberInput
                                label="X"
                                value={comp.x}
                                onChange={(v) =>
                                    handleUpdateRoomComponent(comp.id, {
                                        x: v,
                                    })
                                }
                                unit="m"
                                step={0.05}
                                compact
                            />
                            <NumberInput
                                label="Y"
                                value={comp.y}
                                onChange={(v) =>
                                    handleUpdateRoomComponent(comp.id, {
                                        y: v,
                                    })
                                }
                                unit="m"
                                step={0.05}
                                compact
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Wall Properties ──────────────────────────────────────────────────────────

function WallProperties({ wallId }: { wallId: string }) {
    const wall = useFloorplanStore((s) => s.walls[wallId]);
    const startCorner = useFloorplanStore((s) =>
        wall ? s.corners[wall.startId] : undefined,
    );
    const endCorner = useFloorplanStore((s) =>
        wall ? s.corners[wall.endId] : undefined,
    );
    const getWallLength = useFloorplanStore((s) => s.getWallLength);
    const getResolvedWallThickness = useFloorplanStore(
        (s) => s.getResolvedWallThickness,
    );
    const getResolvedWallHeight = useFloorplanStore(
        (s) => s.getResolvedWallHeight,
    );
    const defaultWallThickness = useFloorplanStore(
        (s) => s.defaultWallThickness,
    );
    const defaultWallHeight = useFloorplanStore((s) => s.defaultWallHeight);
    const updateWall = useFloorplanStore((s) => s.updateWall);
    const removeWall = useFloorplanStore((s) => s.removeWall);
    const addOpening = useFloorplanStore((s) => s.addOpening);
    const removeOpening = useFloorplanStore((s) => s.removeOpening);
    const updateOpening = useFloorplanStore((s) => s.updateOpening);
    const addComponent = useFloorplanStore((s) => s.addComponent);
    const removeComponent = useFloorplanStore((s) => s.removeComponent);
    const updateComponent = useFloorplanStore((s) => s.updateComponent);
    const pushHistory = useFloorplanStore((s) => s.pushHistory);
    const selectWall = useFloorplanStore((s) => s.selectWall);

    const usesDefaultThickness = wall?.thickness === null;
    const usesDefaultHeight = wall?.height === null;
    const resolvedThickness = getResolvedWallThickness(wallId);
    const resolvedHeight = getResolvedWallHeight(wallId);

    const handleThicknessChange = useCallback(
        (value: number) => {
            if (isNaN(value) || value <= 0) return;
            pushHistory();
            updateWall(wallId, { thickness: value });
        },
        [wallId, updateWall, pushHistory],
    );

    const handleHeightChange = useCallback(
        (value: number) => {
            if (isNaN(value) || value <= 0) return;
            pushHistory();
            updateWall(wallId, { height: value });
        },
        [wallId, updateWall, pushHistory],
    );

    const handleToggleDefaultThickness = useCallback(
        (useDefault: boolean) => {
            pushHistory();
            updateWall(wallId, {
                thickness: useDefault ? null : defaultWallThickness,
            });
        },
        [wallId, updateWall, pushHistory, defaultWallThickness],
    );

    const handleToggleDefaultHeight = useCallback(
        (useDefault: boolean) => {
            pushHistory();
            updateWall(wallId, {
                height: useDefault ? null : defaultWallHeight,
            });
        },
        [wallId, updateWall, pushHistory, defaultWallHeight],
    );

    const handleToggleVisible = useCallback(
        (visible: boolean) => {
            pushHistory();
            updateWall(wallId, { visible });
        },
        [wallId, updateWall, pushHistory],
    );

    const handleDelete = useCallback(() => {
        pushHistory();
        removeWall(wallId);
        selectWall(null);
    }, [wallId, removeWall, pushHistory, selectWall]);

    const handleAddDoor = useCallback(() => {
        const length = getWallLength(wallId);
        pushHistory();
        addOpening(wallId, {
            type: "door",
            offset: Math.max(0, (length - 0.9) / 2),
            width: 0.9,
            height: 2.1,
            elevation: 0,
            face: "left",
        });
    }, [wallId, addOpening, getWallLength, pushHistory]);

    const handleAddWindow = useCallback(() => {
        const length = getWallLength(wallId);
        pushHistory();
        addOpening(wallId, {
            type: "window",
            offset: Math.max(0, (length - 1.2) / 2),
            width: 1.2,
            height: 1.0,
            elevation: 0.9,
            face: "left",
        });
    }, [wallId, addOpening, getWallLength, pushHistory]);

    const handleAddHole = useCallback(() => {
        const length = getWallLength(wallId);
        pushHistory();
        addOpening(wallId, {
            type: "hole",
            offset: Math.max(0, (length - 1.0) / 2),
            width: 1.0,
            height: 1.0,
            elevation: 0.5,
            face: "left",
        });
    }, [wallId, addOpening, getWallLength, pushHistory]);

    const handleRemoveOpening = useCallback(
        (openingId: string) => {
            pushHistory();
            removeOpening(wallId, openingId);
        },
        [wallId, removeOpening, pushHistory],
    );

    const handleUpdateOpening = useCallback(
        (openingId: string, patch: Partial<Omit<WallOpening, "id">>) => {
            pushHistory();
            updateOpening(wallId, openingId, patch);
        },
        [wallId, updateOpening, pushHistory],
    );

    const handleAddLight = useCallback(() => {
        pushHistory();
        addComponent(wallId, {
            type: "light",
            label: "Wall Light",
            offset: getWallLength(wallId) / 2,
            elevation: 2.0,
            face: "left",
        });
    }, [wallId, addComponent, getWallLength, pushHistory]);

    const handleAddSensor = useCallback(() => {
        pushHistory();
        addComponent(wallId, {
            type: "sensor",
            label: "Sensor",
            offset: getWallLength(wallId) / 2,
            elevation: 2.0,
            face: "left",
        });
    }, [wallId, addComponent, getWallLength, pushHistory]);

    const handleAddOutlet = useCallback(() => {
        pushHistory();
        addComponent(wallId, {
            type: "outlet",
            label: "Power Outlet",
            offset: getWallLength(wallId) / 2,
            elevation: 0.3,
            face: "left",
        });
    }, [wallId, addComponent, getWallLength, pushHistory]);

    const handleAddSwitch = useCallback(() => {
        pushHistory();
        addComponent(wallId, {
            type: "switch",
            label: "Light Switch",
            offset: 0.15,
            elevation: 1.1,
            face: "left",
        });
    }, [wallId, addComponent, pushHistory]);

    const handleUpdateComponent = useCallback(
        (componentId: string, patch: Partial<Omit<WallComponent, "id">>) => {
            pushHistory();
            updateComponent(wallId, componentId, patch);
        },
        [wallId, updateComponent, pushHistory],
    );

    const handleRemoveComponent = useCallback(
        (componentId: string) => {
            pushHistory();
            removeComponent(wallId, componentId);
        },
        [wallId, removeComponent, pushHistory],
    );

    if (!wall) return null;

    const length = getWallLength(wallId);

    return (
        <div className="divide-y divide-gray-700/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-white">Wall</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Length: {length.toFixed(2)}m
                    </p>
                </div>
                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                    title="Delete wall"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
            </div>

            {/* Visibility */}
            <div className="px-4 py-3 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={wall.visible === false}
                        onChange={(e) => handleToggleVisible(!e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                    />
                    <div>
                        <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                            Invisible wall
                        </span>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            Divides rooms without rendering in 3D
                        </p>
                    </div>
                </label>
            </div>

            {/* Dimensions */}
            <div className="px-4 py-3 space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Dimensions
                </h4>

                {/* Thickness */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={usesDefaultThickness}
                            onChange={(e) =>
                                handleToggleDefaultThickness(e.target.checked)
                            }
                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                        />
                        <span className="text-xs text-gray-400">
                            Use plan default thickness
                        </span>
                    </label>
                    {usesDefaultThickness ? (
                        <ReadonlyField
                            label="Thickness"
                            value={`${resolvedThickness.toFixed(2)} m (plan default)`}
                        />
                    ) : (
                        <NumberInput
                            label="Thickness"
                            value={resolvedThickness}
                            onChange={handleThicknessChange}
                            unit="m"
                            min={0.05}
                            max={2}
                            step={0.01}
                        />
                    )}
                </div>

                {/* Height */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={usesDefaultHeight}
                            onChange={(e) =>
                                handleToggleDefaultHeight(e.target.checked)
                            }
                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                        />
                        <span className="text-xs text-gray-400">
                            Use plan default height
                        </span>
                    </label>
                    {usesDefaultHeight ? (
                        <ReadonlyField
                            label="Height"
                            value={`${resolvedHeight.toFixed(2)} m (plan default)`}
                        />
                    ) : (
                        <NumberInput
                            label="Height"
                            value={resolvedHeight}
                            onChange={handleHeightChange}
                            unit="m"
                            min={0.5}
                            max={10}
                            step={0.1}
                        />
                    )}
                </div>

                {/* Summary in cm */}
                <div className="grid grid-cols-2 gap-3">
                    <ReadonlyField
                        label="Thickness"
                        value={`${(resolvedThickness * 100).toFixed(0)} cm`}
                    />
                    <ReadonlyField
                        label="Height"
                        value={`${(resolvedHeight * 100).toFixed(0)} cm`}
                    />
                </div>
            </div>

            {/* Openings */}
            <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Openings ({wall.openings.length})
                    </h4>
                    <div className="flex gap-1">
                        <SmallButton onClick={handleAddDoor} title="Add door">
                            🚪
                        </SmallButton>
                        <SmallButton
                            onClick={handleAddWindow}
                            title="Add window"
                        >
                            🪟
                        </SmallButton>
                        <SmallButton onClick={handleAddHole} title="Add hole">
                            ⬜
                        </SmallButton>
                    </div>
                </div>

                {wall.openings.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No openings</p>
                )}

                {wall.openings.map((opening) => (
                    <OpeningEditor
                        key={opening.id}
                        opening={opening}
                        wallLength={length}
                        wallHeight={resolvedHeight}
                        onUpdate={(patch) =>
                            handleUpdateOpening(opening.id, patch)
                        }
                        onRemove={() => handleRemoveOpening(opening.id)}
                    />
                ))}
            </div>

            {/* Components */}
            <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Components ({wall.components.length})
                    </h4>
                    <div className="flex gap-1">
                        <SmallButton onClick={handleAddLight} title="Add light">
                            💡
                        </SmallButton>
                        <SmallButton
                            onClick={handleAddSensor}
                            title="Add sensor"
                        >
                            📡
                        </SmallButton>
                        <SmallButton
                            onClick={handleAddOutlet}
                            title="Add outlet"
                        >
                            🔌
                        </SmallButton>
                        <SmallButton
                            onClick={handleAddSwitch}
                            title="Add switch"
                        >
                            🔘
                        </SmallButton>
                    </div>
                </div>

                {wall.components.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                        No components
                    </p>
                )}

                {wall.components.map((comp) => (
                    <div
                        key={comp.id}
                        className="bg-gray-700/30 rounded-lg p-2.5 space-y-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-200 capitalize">
                                {getComponentIcon(comp.type)} {comp.label}
                            </span>
                            <button
                                onClick={() => handleRemoveComponent(comp.id)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                                title="Remove component"
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
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <NumberInput
                                label="Offset"
                                value={comp.offset}
                                onChange={(v) =>
                                    handleUpdateComponent(comp.id, { offset: v })
                                }
                                unit="m"
                                min={0}
                                max={length}
                                step={0.05}
                                compact
                            />
                            <NumberInput
                                label="Elevation"
                                value={comp.elevation}
                                onChange={(v) =>
                                    handleUpdateComponent(comp.id, {
                                        elevation: v,
                                    })
                                }
                                unit="m"
                                min={0}
                                max={resolvedHeight}
                                step={0.05}
                                compact
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-500">
                                Face:
                            </label>
                            <select
                                value={comp.face}
                                onChange={(e) =>
                                    handleUpdateComponent(comp.id, {
                                        face: e.target.value as
                                            | "left"
                                            | "right",
                                    })
                                }
                                className="text-[10px] bg-gray-700 text-gray-300 rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Opening Editor ───────────────────────────────────────────────────────────

function OpeningEditor({
    opening,
    wallLength,
    wallHeight,
    onUpdate,
    onRemove,
}: {
    opening: WallOpening;
    wallLength: number;
    wallHeight: number;
    onUpdate: (patch: Partial<Omit<WallOpening, "id">>) => void;
    onRemove: () => void;
}) {
    const typeLabel =
        opening.type === "door"
            ? "🚪 Door"
            : opening.type === "window"
              ? "🪟 Window"
              : "⬜ Hole";

    return (
        <div className="bg-gray-700/30 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-200">
                    {typeLabel}
                </span>
                <button
                    onClick={onRemove}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove opening"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <NumberInput
                    label="Offset"
                    value={opening.offset}
                    onChange={(v) => onUpdate({ offset: v })}
                    unit="m"
                    min={0}
                    max={Math.max(0, wallLength - opening.width)}
                    step={0.05}
                    compact
                />
                <NumberInput
                    label="Width"
                    value={opening.width}
                    onChange={(v) => onUpdate({ width: v })}
                    unit="m"
                    min={0.1}
                    max={wallLength}
                    step={0.05}
                    compact
                />
                <NumberInput
                    label="Height"
                    value={opening.height}
                    onChange={(v) => onUpdate({ height: v })}
                    unit="m"
                    min={0.1}
                    max={wallHeight}
                    step={0.05}
                    compact
                />
                <NumberInput
                    label="Elevation"
                    value={opening.elevation}
                    onChange={(v) => onUpdate({ elevation: v })}
                    unit="m"
                    min={0}
                    max={Math.max(0, wallHeight - opening.height)}
                    step={0.05}
                    compact
                />
            </div>
            <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-500">Face:</label>
                <select
                    value={opening.face}
                    onChange={(e) =>
                        onUpdate({ face: e.target.value as "left" | "right" })
                    }
                    className="text-[10px] bg-gray-700 text-gray-300 rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                </select>
            </div>
        </div>
    );
}

// ─── Corner Properties ────────────────────────────────────────────────────────

function CornerProperties({ cornerId }: { cornerId: string }) {
    const corner = useFloorplanStore((s) => s.corners[cornerId]);
    const getWallsAtCorner = useFloorplanStore((s) => s.getWallsAtCorner);
    const moveCorner = useFloorplanStore((s) => s.moveCorner);
    const removeCorner = useFloorplanStore((s) => s.removeCorner);
    const selectCorner = useFloorplanStore((s) => s.selectCorner);
    const pushHistory = useFloorplanStore((s) => s.pushHistory);

    const connectedWallIds = corner ? getWallsAtCorner(cornerId) : [];

    const handleXChange = useCallback(
        (value: number) => {
            if (!corner || isNaN(value)) return;
            pushHistory();
            moveCorner(cornerId, { x: value, y: corner.position.y });
        },
        [cornerId, corner, moveCorner, pushHistory],
    );

    const handleYChange = useCallback(
        (value: number) => {
            if (!corner || isNaN(value)) return;
            pushHistory();
            moveCorner(cornerId, { x: corner.position.x, y: value });
        },
        [cornerId, corner, moveCorner, pushHistory],
    );

    const handleDelete = useCallback(() => {
        pushHistory();
        removeCorner(cornerId);
        selectCorner(null);
    }, [cornerId, removeCorner, pushHistory, selectCorner]);

    if (!corner) return null;

    return (
        <div className="divide-y divide-gray-700/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-white">Corner</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {connectedWallIds.length} connected wall
                        {connectedWallIds.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                    title="Delete corner (and connected walls)"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
            </div>

            {/* Position */}
            <div className="px-4 py-3 space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Position
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                        label="X"
                        value={corner.position.x}
                        onChange={handleXChange}
                        unit="m"
                        step={0.1}
                    />
                    <NumberInput
                        label="Y"
                        value={corner.position.y}
                        onChange={handleYChange}
                        unit="m"
                        step={0.1}
                    />
                </div>
            </div>

            {/* Connected walls info */}
            {connectedWallIds.length > 0 && (
                <div className="px-4 py-3 space-y-2">
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Connected Walls
                    </h4>
                    {connectedWallIds.map((wid) => (
                        <ConnectedWallRow key={wid} wallId={wid} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ConnectedWallRow({ wallId }: { wallId: string }) {
    const wall = useFloorplanStore((s) => s.walls[wallId]);
    const getWallLength = useFloorplanStore((s) => s.getWallLength);
    const selectWall = useFloorplanStore((s) => s.selectWall);

    if (!wall) return null;

    const length = getWallLength(wallId);

    return (
        <button
            onClick={() => selectWall(wallId)}
            className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-2.5 py-1.5 hover:bg-gray-700/50 transition-colors text-left"
        >
            <span className="text-xs text-gray-300">Wall</span>
            <span className="text-xs text-gray-400">{length.toFixed(2)}m</span>
        </button>
    );
}

// ─── Floor Properties ─────────────────────────────────────────────────────────

function FloorProperties() {
    const floors = useFloorplanStore(useShallow((s) => s.floors));
    const currentFloorId = useFloorplanStore((s) => s.currentFloorId);
    const updateFloor = useFloorplanStore((s) => s.updateFloor);

    const currentFloor = floors.find((f) => f.id === currentFloorId);
    if (!currentFloor) return null;

    return (
        <div className="border-b border-gray-700/50">
            <div className="px-4 py-3 border-b border-gray-700/30">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Floor Settings
                </h3>
            </div>
            <div className="px-4 py-3 space-y-3">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Name</label>
                    <input
                        type="text"
                        value={currentFloor.name}
                        onChange={(e) => updateFloor(currentFloorId, { name: e.target.value })}
                        className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">
                        Floor-to-Floor Height (m)
                    </label>
                    <input
                        type="number"
                        step={0.1}
                        min={1}
                        max={10}
                        value={currentFloor.floorHeight}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateFloor(currentFloorId, { floorHeight: v });
                        }}
                        className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                    />
                </div>
                <div className="text-xs text-gray-500">
                    Level: {currentFloor.level}
                </div>
            </div>
        </div>
    );
}

// ─── Staircase Properties ────────────────────────────────────────────────────

function StaircaseProperties({ staircaseId }: { staircaseId: string }) {
    const staircase = useFloorplanStore((s) => s.staircaseOpenings[staircaseId]);
    const updateStaircaseOpening = useFloorplanStore((s) => s.updateStaircaseOpening);
    const removeStaircaseOpening = useFloorplanStore((s) => s.removeStaircaseOpening);

    if (!staircase) return null;

    return (
        <div className="border-b border-gray-700/50">
            <div className="px-4 py-3 border-b border-gray-700/30">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Staircase Opening
                </h3>
            </div>
            <div className="px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Width (m)</label>
                        <input
                            type="number"
                            step={0.1}
                            min={0.5}
                            value={staircase.width}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) updateStaircaseOpening(staircaseId, { width: v });
                            }}
                            className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                                focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Depth (m)</label>
                        <input
                            type="number"
                            step={0.1}
                            min={0.5}
                            value={staircase.depth}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) updateStaircaseOpening(staircaseId, { depth: v });
                            }}
                            className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                                focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">X (m)</label>
                        <input
                            type="number"
                            step={0.1}
                            value={staircase.position.x}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) updateStaircaseOpening(staircaseId, { position: { ...staircase.position, x: v } });
                            }}
                            className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                                focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Y (m)</label>
                        <input
                            type="number"
                            step={0.1}
                            value={staircase.position.y}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) updateStaircaseOpening(staircaseId, { position: { ...staircase.position, y: v } });
                            }}
                            className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                                focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Rotation (deg)</label>
                    <input
                        type="number"
                        step={15}
                        value={Math.round((staircase.rotation * 180) / Math.PI)}
                        onChange={(e) => {
                            const deg = parseFloat(e.target.value);
                            if (!isNaN(deg)) updateStaircaseOpening(staircaseId, { rotation: (deg * Math.PI) / 180 });
                        }}
                        className="w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm
                            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                    />
                </div>
                <button
                    onClick={() => removeStaircaseOpening(staircaseId)}
                    className="w-full mt-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 rounded-md transition-all"
                >
                    Delete Staircase
                </button>
            </div>
        </div>
    );
}

// ─── Plan Settings ────────────────────────────────────────────────────────────

function PlanSettings() {
    const defaultWallThickness = useFloorplanStore(
        (s) => s.defaultWallThickness,
    );
    const defaultWallHeight = useFloorplanStore((s) => s.defaultWallHeight);
    const setDefaultWallThickness = useFloorplanStore(
        (s) => s.setDefaultWallThickness,
    );
    const setDefaultWallHeight = useFloorplanStore(
        (s) => s.setDefaultWallHeight,
    );
    const currentPlanName = useFloorplanStore((s) => s.currentPlanName);

    const handleThicknessChange = useCallback(
        (value: number) => {
            if (isNaN(value) || value <= 0) return;
            setDefaultWallThickness(value);
        },
        [setDefaultWallThickness],
    );

    const handleHeightChange = useCallback(
        (value: number) => {
            if (isNaN(value) || value <= 0) return;
            setDefaultWallHeight(value);
        },
        [setDefaultWallHeight],
    );

    return (
        <div className="divide-y divide-gray-700/50">
            <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-white">
                    Plan Settings
                </h3>
                {currentPlanName && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {currentPlanName}
                    </p>
                )}
            </div>
            <div className="px-4 py-3 space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Default Wall Dimensions
                </h4>
                <p className="text-[10px] text-gray-500">
                    New walls and walls set to "use plan default" will use these
                    values.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                        label="Thickness"
                        value={defaultWallThickness}
                        onChange={handleThicknessChange}
                        unit="m"
                        min={0.05}
                        max={2}
                        step={0.01}
                    />
                    <NumberInput
                        label="Height"
                        value={defaultWallHeight}
                        onChange={handleHeightChange}
                        unit="m"
                        min={0.5}
                        max={10}
                        step={0.1}
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <ReadonlyField
                        label="Thickness"
                        value={`${(defaultWallThickness * 100).toFixed(0)} cm`}
                    />
                    <ReadonlyField
                        label="Height"
                        value={`${(defaultWallHeight * 100).toFixed(0)} cm`}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Floorplan Properties ─────────────────────────────────────────────────────

function FloorplanProperties() {
    const floorplan = useFloorplanStore((s) => s.floorplan);
    const updateFloorplan = useFloorplanStore((s) => s.updateFloorplan);

    if (!floorplan) return null;

    const scale = floorplan.scale ?? 1;

    return (
        <div className="divide-y divide-gray-700/50">
            {/* Header */}
            <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Floorplan</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {floorplan.name}
                </p>
            </div>

            {/* Settings */}
            <div className="px-4 py-3 space-y-3">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Scale & Appearance
                </h4>

                {/* Uniform scale slider */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Scale</label>
                        <span className="text-xs text-gray-500 tabular-nums">
                            {scale.toFixed(2)}×
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0.1}
                        max={10}
                        step={0.05}
                        value={scale}
                        onChange={(e) =>
                            updateFloorplan({
                                scale: parseFloat(e.target.value),
                            })
                        }
                        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>0.1×</span>
                        <button
                            onClick={() => updateFloorplan({ scale: 1 })}
                            className="text-gray-500 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                            Reset
                        </button>
                        <span>10×</span>
                    </div>
                </div>

                {/* Scaled real-world dimensions (read-only) */}
                <div className="grid grid-cols-2 gap-3">
                    <ReadonlyField
                        label="Width"
                        value={`${(floorplan.widthMeters * scale).toFixed(1)} m`}
                    />
                    <ReadonlyField
                        label="Height"
                        value={`${(floorplan.heightMeters * scale).toFixed(1)} m`}
                    />
                </div>

                {/* Opacity slider */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Opacity</label>
                        <span className="text-xs text-gray-500 tabular-nums">
                            {Math.round(floorplan.opacity * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={floorplan.opacity}
                        onChange={(e) =>
                            updateFloorplan({
                                opacity: parseFloat(e.target.value),
                            })
                        }
                        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

interface NumberInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    compact?: boolean;
}

function NumberInput({
    label,
    value,
    onChange,
    unit,
    min,
    max,
    step = 0.1,
    compact = false,
}: NumberInputProps) {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            const clamped = Math.min(
                max ?? Infinity,
                Math.max(min ?? -Infinity, val),
            );
            onChange(clamped);
        },
        [onChange, min, max],
    );

    return (
        <div className="space-y-1">
            <label
                className={`text-gray-400 block ${compact ? "text-[10px]" : "text-xs"}`}
            >
                {label}
            </label>
            <div className="relative">
                <input
                    type="number"
                    value={parseFloat(value.toFixed(3))}
                    onChange={handleChange}
                    min={min}
                    max={max}
                    step={step}
                    className={`
            w-full bg-gray-700/50 text-gray-200 rounded-md border border-gray-600
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none
            transition-colors tabular-nums
            ${compact ? "text-[11px] px-2 py-1" : "text-xs px-2.5 py-1.5"}
            ${unit ? "pr-7" : ""}
            [appearance:textfield]
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
          `}
                />
                {unit && (
                    <span
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none ${
                            compact ? "text-[10px]" : "text-xs"
                        }`}
                    >
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] text-gray-500 block">{label}</label>
            <div className="text-[11px] text-gray-400 tabular-nums">
                {value}
            </div>
        </div>
    );
}

function SmallButton({
    onClick,
    title,
    children,
}: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded-md text-xs
        bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white
        border border-gray-600/50 hover:border-gray-500/50 transition-all"
        >
            {children}
        </button>
    );
}

function getComponentIcon(type: string): string {
    switch (type) {
        case "light":
            return "💡";
        case "sensor":
            return "📡";
        case "outlet":
            return "🔌";
        case "switch":
            return "🔘";
        default:
            return "📦";
    }
}
