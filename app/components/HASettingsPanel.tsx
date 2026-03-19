import { useState, useEffect, useCallback } from "react";
import { useHAStore } from "../store/useHAStore";

export function HASettingsPanel() {
    const [expanded, setExpanded] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [host, setHost] = useState("");
    const [token, setToken] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    // Live connection status from the WS bridge
    const connectionStatus = useHAStore((s) => s.connectionStatus);
    const entityCount = useHAStore((s) => Object.keys(s.states).length);

    // Load current config status on mount / expand
    useEffect(() => {
        if (!expanded) return;
        fetch("/api/ha/config")
            .then((r) => r.json())
            .then((data: { configured: boolean }) => setConfigured(data.configured))
            .catch(() => {});
    }, [expanded]);

    const handleSave = useCallback(async () => {
        if (!host.trim() || !token.trim()) return;
        setSaving(true);
        setSaveError("");
        try {
            const res = await fetch("/api/ha/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ host: host.trim(), token: token.trim() }),
            });
            if (res.ok) {
                setConfigured(true);
                setToken(""); // clear token field after save
            } else {
                setSaveError("Failed to save configuration.");
            }
        } catch {
            setSaveError("Network error.");
        } finally {
            setSaving(false);
        }
    }, [host, token]);

    const handleDisconnect = useCallback(async () => {
        await fetch("/api/ha/config", { method: "DELETE" });
        setConfigured(false);
        setHost("");
        setToken("");
        setSaveError("");
    }, []);

    // Derive badge style from live WS connection status
    const badgeClass =
        connectionStatus === "connected"
            ? "bg-green-500/20 text-green-400 border-green-500/30"
            : connectionStatus === "connecting"
              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              : connectionStatus === "error"
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : configured
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "bg-gray-700/50 text-gray-500 border-gray-600/30";

    const badgeLabel =
        connectionStatus === "connected"
            ? `Connected (${entityCount})`
            : connectionStatus === "connecting"
              ? "Connecting…"
              : connectionStatus === "error"
                ? "Error"
                : configured
                  ? "Configured"
                  : "Not configured";

    return (
        <div className="divide-y divide-gray-700/50">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Home Assistant</h3>
                    <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${badgeClass}`}
                    >
                        {badgeLabel}
                    </span>
                </div>
                <span className="text-xs text-gray-500">{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
                <div className="px-4 py-3 space-y-3">
                    <div className="space-y-2">
                        <div>
                            <label className="text-[11px] text-gray-400 block mb-1">
                                Host URL
                            </label>
                            <input
                                type="url"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                                placeholder="http://homeassistant.local:8123"
                                className="w-full text-xs bg-gray-700 text-gray-200 rounded px-2 py-1.5
                                    border border-gray-600 focus:border-blue-500 focus:outline-none
                                    placeholder-gray-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] text-gray-400 block mb-1">
                                Long-Lived Access Token
                            </label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi…"
                                className="w-full text-xs bg-gray-700 text-gray-200 rounded px-2 py-1.5
                                    border border-gray-600 focus:border-blue-500 focus:outline-none
                                    placeholder-gray-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!host.trim() || !token.trim() || saving}
                        className="w-full text-xs py-1.5 rounded bg-blue-600 hover:bg-blue-500
                            disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                    >
                        {saving ? "Saving…" : "Save & Connect"}
                    </button>

                    {saveError && (
                        <p className="text-[11px] text-red-400">{saveError}</p>
                    )}

                    {configured && (
                        <button
                            onClick={handleDisconnect}
                            className="w-full text-[11px] text-gray-500 hover:text-red-400
                                py-1.5 rounded border border-gray-700/50 hover:border-red-500/30
                                transition-colors"
                        >
                            Disconnect
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
