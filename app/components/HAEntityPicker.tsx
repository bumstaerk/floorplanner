import { useState, useEffect, useRef, useCallback } from "react";
import type { HAEntity } from "../store/types";

interface HAEntityPickerProps {
    value: string | null;
    onChange: (entityId: string | null) => void;
}

export function HAEntityPicker({ value, onChange }: HAEntityPickerProps) {
    const [entities, setEntities] = useState<HAEntity[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/ha/entities")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setEntities(data as HAEntity[]);
                }
            })
            .catch(() => {})
            .finally(() => setLoaded(true));
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const boundEntity = value ? entities.find((e) => e.entityId === value) : null;

    const filtered = query
        ? entities.filter(
              (e) =>
                  e.entityId.toLowerCase().includes(query.toLowerCase()) ||
                  e.friendlyName.toLowerCase().includes(query.toLowerCase()),
          )
        : entities;

    const handleSelect = useCallback(
        (entityId: string) => {
            onChange(entityId);
            setOpen(false);
            setQuery("");
        },
        [onChange],
    );

    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(null);
            setQuery("");
        },
        [onChange],
    );

    if (!loaded) {
        return (
            <p className="text-[10px] text-gray-500 italic">Loading entities…</p>
        );
    }

    if (entities.length === 0) {
        return (
            <p className="text-[10px] text-gray-500 italic">
                No HA entities — configure connection in Settings
            </p>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Current binding display / search input */}
            <div className="flex items-center gap-1">
                <div
                    className="flex-1 relative cursor-pointer"
                    onClick={() => {
                        setOpen((o) => !o);
                        setQuery("");
                    }}
                >
                    {open ? (
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Search entities…"
                            className="w-full text-[11px] bg-gray-700 text-gray-200 rounded px-2 py-1
                                border border-blue-500 focus:outline-none placeholder-gray-500"
                        />
                    ) : (
                        <div className="text-[11px] bg-gray-700 text-gray-200 rounded px-2 py-1
                            border border-gray-600 truncate min-h-[1.75rem] flex items-center">
                            {boundEntity ? (
                                <span>
                                    <span className="text-blue-400">{boundEntity.friendlyName}</span>
                                    <span className="text-gray-500 ml-1">({boundEntity.entityId})</span>
                                </span>
                            ) : (
                                <span className="text-gray-500 italic">None</span>
                            )}
                        </div>
                    )}
                </div>
                {value && (
                    <button
                        onClick={handleClear}
                        className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Unbind entity"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {open && (
                <div className="absolute top-full left-0 right-0 mt-0.5 z-50
                    bg-gray-800 border border-gray-600 rounded shadow-xl max-h-48 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="text-[11px] text-gray-500 italic px-2 py-2">No matches</p>
                    ) : (
                        filtered.map((entity) => (
                            <button
                                key={entity.entityId}
                                onClick={() => handleSelect(entity.entityId)}
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-700 transition-colors"
                            >
                                <div className="text-[11px] text-gray-200 truncate">
                                    {entity.friendlyName}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                    {entity.entityId}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
