# Design: Home Assistant Real-Time State — Phase 2

## Context

The project runs as a Node.js server via `react-router-serve` with SSR enabled. The server
process is long-lived and can hold a persistent outbound WebSocket connection to HA. The
browser needs a way to receive live HA state without polling the REST proxy from Phase 1.

Home Assistant exposes a native WebSocket API at `ws://${host}/api/websocket`. It uses a
JSON message protocol:
1. Server sends `{ type: "auth_required" }`
2. Client replies `{ type: "auth", access_token: "..." }`
3. Server replies `{ type: "auth_ok" }` or `{ type: "auth_invalid" }`
4. Client sends `{ id: 1, type: "get_states" }` — bulk state snapshot
5. Client sends `{ id: 2, type: "subscribe_events", event_type: "state_changed" }`
6. Server streams `{ type: "event", event: { data: { entity_id, new_state } } }` events

## Goals / Non-Goals

**Goals:**
- Single outbound HA WebSocket connection shared across all browser clients
- Browser clients get full state snapshot on connect, then incremental updates
- Automatic reconnect to HA on disconnect (exponential backoff, max 30s)
- Connection status visible in the Settings panel
- Clean teardown when HA config is deleted

**Non-Goals:**
- Per-user or per-plan WebSocket sessions
- Filtering which entities are forwarded (send everything, client filters)
- State persistence to SQLite
- Write-back / service calls (Phase 4)

## Decisions

### 1. Server-side bridge — singleton module, not a separate process

**Decision**: Implement the HA WebSocket client as a lazy-initialized singleton in
`app/services/haWebSocketBridge.ts`. It is started on first browser client connection and
torn down when HA config is deleted.

**Rationale**: The project is a single Node process (`react-router-serve`). A separate
microservice would require inter-process communication (IPC, Redis pub/sub) and additional
deployment complexity. A singleton module within the same process is simpler, has zero
latency overhead, and is sufficient for a single-household deployment (low concurrent client
count).

**Alternatives considered**:
- *Separate WebSocket microservice*: Decoupled but over-engineered for this use case. Would
  require a process manager (PM2) and a message bus.
- *Server-Sent Events (SSE)*: Unidirectional, simpler than WS, but we need bidirectional
  communication in Phase 4 (service calls). Using WS now avoids a later migration.

### 2. Browser-facing WebSocket — raw Node.js `upgrade` event on the HTTP server

**Decision**: Intercept the Node.js `http.Server` `upgrade` event in a Vite plugin (dev) or
a custom server entry (prod) to handle `ws://host/api/ha/ws` upgrades. Use the `ws` npm
package for both server-side (HA client) and browser-facing (upgrade handler) WebSocket logic.

**Rationale**: React Router v7 does not have built-in WebSocket support. The recommended
approach for adding WebSocket handling to a `react-router-serve` app is to hook into the
underlying Node HTTP server's `upgrade` event. This is a documented pattern in the
React Router community and requires minimal boilerplate.

In development (`pnpm dev`), Vite proxies WebSocket connections — a Vite plugin is needed to
forward `/api/ha/ws` upgrade requests to a custom handler before Vite's HMR WS intercepts
them.

In production (`pnpm start`), `@react-router/serve` exposes the underlying HTTP server via
`createRequestHandler`. We attach the upgrade handler there.

**Implementation entry point**: `app/server.ts` (custom server) that wraps
`@react-router/node`'s `createRequestHandler` and adds the `upgrade` listener.

### 3. Message protocol — browser client receives two message types

**Decision**: The bridge sends two JSON message shapes to browser clients:

```ts
// Full snapshot on connect
{ type: "ha_snapshot", states: Record<entityId, HAEntityState> }

// Incremental update
{ type: "ha_state_changed", entityId: string, state: HAEntityState }
```

`HAEntityState` mirrors HA's state object shape: `{ state: string, attributes: Record<string, unknown>, lastChanged: string }`.

**Rationale**: Separating snapshot from incremental updates lets the client store initialise
cleanly and lets components distinguish "loading" from "live" states.

### 4. Client state — new `useHAStore` Zustand store (not merged into `useFloorplanStore`)

**Decision**: Create a separate `app/store/useHAStore.ts` with shape:
```ts
interface HAStore {
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  states: Record<string, HAEntityState>;   // entityId → state
  setSnapshot: (states: Record<string, HAEntityState>) => void;
  applyStateChange: (entityId: string, state: HAEntityState) => void;
  setConnectionStatus: (status: HAStore["connectionStatus"]) => void;
}
```

**Rationale**: HA state is entirely orthogonal to floorplan geometry. Merging it into
`useFloorplanStore` would bloat the store, pollute history snapshots, and couple two
unrelated concerns. A separate store is consistent with the existing `useThemeStore`
pattern and keeps `useFloorplanStore` focused on geometry.

### 5. Reconnect strategy — exponential backoff with cap

**Decision**: On HA WebSocket disconnect, the bridge attempts reconnect after:
1s → 2s → 4s → 8s → 16s → 30s (capped), indefinitely until config is deleted or a
connection succeeds.

**Rationale**: HA is a local home server that may restart or lose network briefly. Indefinite
reconnect with backoff is the correct UX — the dashboard should self-heal without user
intervention.

## Data Flow

```
HA WebSocket API  ws://${host}/api/websocket
        ↕  (server process, persistent)
haWebSocketBridge.ts  (singleton)
  ├─ on connect:  send get_states → broadcast ha_snapshot to all browser clients
  ├─ on state_changed: broadcast ha_state_changed to all browser clients
  └─ on disconnect: exponential backoff reconnect

        ↕  (Node http.Server upgrade event)
/api/ha/ws  (browser-facing WebSocket endpoint)
  ├─ on connect: register client with bridge, send current snapshot immediately
  └─ on close: deregister client from bridge

        ↕  (browser WebSocket)
useHAWebSocket hook  (client singleton, mounts in app root)
  ├─ on ha_snapshot:      useHAStore.setSnapshot(states)
  └─ on ha_state_changed: useHAStore.applyStateChange(entityId, state)

        ↓
useHAStore  (Zustand)
  └─ states: Record<entityId, HAEntityState>

        ↓
useHAEntity(entityId)  (hook used by 3D components in Phase 3)
  └─ returns HAEntityState | null
```

## File Structure

```
app/
  services/
    haWebSocketBridge.ts     # Server-side HA WS client + browser fan-out
  store/
    useHAStore.ts            # Client Zustand store for HA state
  hooks/
    useHAWebSocket.ts        # Browser WS lifecycle hook (mounts once in root)
    useHAEntity.ts           # Per-entity state selector hook
  server.ts                  # Custom Node server entry (wraps react-router-serve)
```

## Custom Server Entry (`app/server.ts`)

React Router v7 supports a custom server entry. We create `app/server.ts` that:
1. Imports `createRequestHandler` from `@react-router/node`
2. Creates an `http.Server` with the request handler
3. Attaches the `upgrade` event listener for `/api/ha/ws`
4. Starts listening on `process.env.PORT ?? 3000`

The `package.json` `start` script changes from `react-router-serve ./build/server/index.js`
to `node ./build/server/app.server.js`.

In development, a Vite plugin in `vite.config.ts` hooks `configureServer` to handle the
`upgrade` event on Vite's dev server before HMR intercepts it.

## Dependencies

```json
"ws": "^8.x"          // server-side WS (HA client + upgrade handler)
"@types/ws": "^8.x"   // devDependency
```
