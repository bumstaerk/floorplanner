/**
 * Server-side singleton that maintains a persistent WebSocket connection to
 * Home Assistant and fans out state updates to all connected browser clients.
 *
 * Protocol:
 *   HA → server: auth_required → server sends auth → HA: auth_ok
 *   Server → HA:  get_states (id=1), subscribe_events state_changed (id=2)
 *   HA → server:  result (states snapshot), event (incremental state_changed)
 *   Server → browsers: ha_snapshot | ha_state_changed
 */

import WebSocket from "ws";
import type { HABridgeMessage, HAEntityState } from "../store/types.js";

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
}

export class HAWebSocketBridge {
  private haWs: WebSocket | null = null;
  private clients: Set<WebSocket> = new Set();
  private stateSnapshot: Record<string, HAEntityState> = {};
  private haConnected = false;
  private host: string | null = null;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex = 0;
  private destroyed = false;
  private msgIdCounter = 0;

  connect(host: string, token: string): void {
    this.destroyed = false;
    this.host = host;
    this.token = token;
    this.backoffIndex = 0;
    this._openConnection();
  }

  disconnect(): void {
    this.destroyed = true;
    this.haConnected = false;
    this.host = null;
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.haWs) {
      this.haWs.terminate();
      this.haWs = null;
    }
    this.stateSnapshot = {};
    this._broadcastToClients({ type: "ha_status", status: "disconnected" });
  }

  registerClient(ws: WebSocket): void {
    this.clients.add(ws);
    // Tell the new client the current HA connection status immediately
    const statusMsg: HABridgeMessage = {
      type: "ha_status",
      status: this.haConnected ? "connected" : "disconnected",
    };
    ws.send(JSON.stringify(statusMsg));
    // Send snapshot if we have one
    if (this.haConnected && Object.keys(this.stateSnapshot).length > 0) {
      const snapshotMsg: HABridgeMessage = { type: "ha_snapshot", states: this.stateSnapshot };
      ws.send(JSON.stringify(snapshotMsg));
    }
  }

  deregisterClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  private _openConnection(): void {
    if (this.destroyed || !this.host || !this.token) return;

    // Derive WebSocket URL from HTTP host
    const wsUrl = this.host
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");

    const ws = new WebSocket(`${wsUrl}/api/websocket`);
    this.haWs = ws;
    this.msgIdCounter = 0;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        this._handleHAMessage(msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      this.haWs = null;
      this.haConnected = false;
      if (!this.destroyed) {
        this._broadcastToClients({ type: "ha_status", status: "disconnected" });
        this._scheduleReconnect();
      }
    });

    ws.on("error", () => {
      // close event will fire after error, triggering reconnect
    });
  }

  private _handleHAMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    if (type === "auth_required") {
      this.haWs?.send(JSON.stringify({ type: "auth", access_token: this.token }));
      return;
    }

    if (type === "auth_ok") {
      this.haConnected = true;
      this._broadcastToClients({ type: "ha_status", status: "connected" });
      // Request full state snapshot
      this.msgIdCounter++;
      const getStatesId = this.msgIdCounter;
      this.haWs?.send(JSON.stringify({ id: getStatesId, type: "get_states" }));

      // Subscribe to state_changed events
      this.msgIdCounter++;
      this.haWs?.send(JSON.stringify({
        id: this.msgIdCounter,
        type: "subscribe_events",
        event_type: "state_changed",
      }));
      return;
    }

    if (type === "auth_invalid") {
      console.error("[HABridge] HA auth invalid — check your token");
      this.haWs?.close();
      return;
    }

    if (type === "result") {
      const result = msg.result;
      if (Array.isArray(result)) {
        // This is the get_states response
        const snapshot: Record<string, HAEntityState> = {};
        for (const s of result as HAState[]) {
          snapshot[s.entity_id] = {
            state: s.state,
            attributes: s.attributes,
            lastChanged: s.last_changed,
          };
        }
        this.stateSnapshot = snapshot;
        this._broadcastToClients({ type: "ha_snapshot", states: snapshot });
      }
      return;
    }

    if (type === "event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (!event) return;
      const eventType = event.event_type as string;
      if (eventType !== "state_changed") return;
      const data = event.data as Record<string, unknown> | undefined;
      if (!data) return;
      const entityId = data.entity_id as string;
      const newState = data.new_state as HAState | null;
      if (!entityId || !newState) return;

      const entityState: HAEntityState = {
        state: newState.state,
        attributes: newState.attributes,
        lastChanged: newState.last_changed,
      };
      this.stateSnapshot[entityId] = entityState;
      this._broadcastToClients({ type: "ha_state_changed", entityId, state: entityState });
    }
  }

  private _broadcastToClients(msg: HABridgeMessage): void {
    const json = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return;
    const delay = BACKOFF_DELAYS[Math.min(this.backoffIndex, BACKOFF_DELAYS.length - 1)];
    this.backoffIndex = Math.min(this.backoffIndex + 1, BACKOFF_DELAYS.length - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._openConnection();
    }, delay);
  }
}

export const haBridge = new HAWebSocketBridge();
