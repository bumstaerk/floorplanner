# Change: Add Home Assistant Real-Time State — Phase 2 (WebSocket Bridge)

## Why

Phase 1 established HA credentials and entity bindings. Phase 2 makes the floorplan
**live** — subscribing to Home Assistant's WebSocket API so that every state change
(light on/off, sensor reading, door open/closed) is immediately available in the browser
without polling. This is the data pipeline that Phase 3 (visual reflection) and Phase 4
(device control) both depend on.

## What Changes

- **New server-side WebSocket bridge** (`app/services/haWebSocketBridge.ts`): a singleton
  Node.js `ws` client that connects to `ws://${haHost}/api/websocket`, authenticates, calls
  `get_states` on connect, and subscribes to `state_changed` events. Runs inside the same
  Node process as `react-router-serve`.
- **New browser-facing WebSocket endpoint** (`/api/ha/ws`): upgrades incoming HTTP connections
  to WebSocket and registers them with the bridge. The bridge fans out every HA state update
  to all connected browser clients.
- **New Zustand store** (`app/store/useHAStore.ts`): a lightweight flat map of
  `entityId → HAEntityState` that the browser WebSocket populates on connect and keeps
  updated on `state_changed` events.
- **New React hook** (`app/hooks/useHAEntity.ts`): reads a single entity's state from
  `useHAStore` by `entityId`. Used in Phase 3 by 3D components.
- **Connection status** in `HASettingsPanel`: live indicator showing Connected / Reconnecting
  / Disconnected based on the WebSocket readyState.
- **`ws` npm dependency** added for the server-side HA WebSocket client.

## Non-Goals (this phase)

- Visual changes in the 3D scene (Phase 3)
- Sending commands / service calls to HA (Phase 4)
- Room-to-area / scene linking (Phase 5)
- Multi-client conflict resolution (last-write-wins is acceptable)
- Persisting entity state to SQLite (state is ephemeral / always live from HA)

## Impact

- **Affected specs**: `ha-realtime-state` (new), `ha-connection` (modified — adds WS status)
- **Affected code**:
  - New: `app/services/haWebSocketBridge.ts`
  - New: `app/store/useHAStore.ts`
  - New: `app/hooks/useHAEntity.ts`
  - New: `app/entry.server.tsx` or server plugin — WebSocket upgrade handler
  - Modified: `app/routes.ts` — register WS upgrade route
  - Modified: `app/components/HASettingsPanel.tsx` — show live connection status
  - `package.json` — add `ws` + `@types/ws` dependencies
