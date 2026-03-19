import { useEffect } from "react";
import { useHAStore } from "../store/useHAStore";
import type { HABridgeMessage } from "../store/types";

/**
 * Opens a WebSocket connection to /api/ha/ws and keeps the useHAStore in sync.
 * Mount once at the app root. Cleans up on unmount.
 */
export function useHAWebSocket(): void {
    const setSnapshot = useHAStore((s) => s.setSnapshot);
    const applyStateChange = useHAStore((s) => s.applyStateChange);
    const setConnectionStatus = useHAStore((s) => s.setConnectionStatus);

    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${protocol}//${window.location.host}/api/ha/ws`;

        const ws = new WebSocket(url);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as HABridgeMessage;
                if (msg.type === "ha_snapshot") {
                    setSnapshot(msg.states);
                } else if (msg.type === "ha_state_changed") {
                    applyStateChange(msg.entityId, msg.state);
                } else if (msg.type === "ha_status") {
                    setConnectionStatus(msg.status);
                }
            } catch {
                // ignore malformed messages
            }
        };

        ws.onclose = () => {
            setConnectionStatus("disconnected");
        };

        ws.onerror = () => {
            setConnectionStatus("disconnected");
        };

        return () => {
            ws.close();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
