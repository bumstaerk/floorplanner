# Tasks: Add Home Assistant Real-Time State — Phase 2

## 1. Dependencies

- [x] 1.1 Add `ws` to `dependencies` in `package.json`
- [x] 1.2 Add `@types/ws` to `devDependencies` in `package.json`
- [x] 1.3 Run `pnpm install` to resolve new packages

## 2. TypeScript Types

- [x] 2.1 Add `HAEntityState` interface to `app/store/types.ts`:
  `{ state: string; attributes: Record<string, unknown>; lastChanged: string }`
- [x] 2.2 Add `HABridgeMessage` discriminated union to `app/store/types.ts`:
  `{ type: "ha_snapshot"; states: Record<string, HAEntityState> }` and
  `{ type: "ha_state_changed"; entityId: string; state: HAEntityState }`
- [x] 2.3 Add `HAConnectionStatus` type alias: `"connecting" | "connected" | "disconnected" | "error"`

## 3. Server-Side HA WebSocket Bridge

- [x] 3.1 Create `app/services/haWebSocketBridge.ts` — export `HAWebSocketBridge` class with:
  - `connect(host: string, token: string): void` — opens WS to HA, handles auth handshake
  - `disconnect(): void` — closes HA connection and cancels reconnect timer
  - `registerClient(ws: WebSocket): void` — adds browser client; immediately sends current snapshot
  - `deregisterClient(ws: WebSocket): void` — removes browser client
  - Private `broadcastToClients(msg: HABridgeMessage): void`
  - Private reconnect loop with exponential backoff (1s→2s→4s→8s→16s→30s cap)
- [x] 3.2 Handle HA auth handshake: respond to `auth_required`, send `auth` message, check `auth_ok` / `auth_invalid`
- [x] 3.3 On `auth_ok`: send `get_states` request and `subscribe_events` for `state_changed`
- [x] 3.4 On `get_states` response: store full state map internally; broadcast `ha_snapshot` to all current browser clients
- [x] 3.5 On `state_changed` event: update internal state map; broadcast `ha_state_changed` to all browser clients
- [x] 3.6 On HA WS close/error: set status to `disconnected`; start backoff reconnect timer
- [x] 3.7 Export a singleton instance: `export const haBridge = new HAWebSocketBridge()`

## 4. Custom Server Entry

- [x] 4.1 Create `app/server.ts` — custom Node HTTP server entry that:
  - Imports `createRequestListener` from `@react-router/node`
  - Builds a `http.createServer` with React Router as the request handler
  - Attaches `server.on("upgrade", ...)` listener that routes `/api/ha/ws` upgrades to `haWsUpgradeHandler`
  - Starts listening on `process.env.PORT ?? 3000`
- [x] 4.2 Create `app/services/haWsUpgradeHandler.ts` — exports a function `haWsUpgradeHandler(req, socket, head)` that:
  - Uses `ws.WebSocketServer` (`{ noServer: true }`) to handle the upgrade
  - Calls `haBridge.registerClient(ws)` on connection
  - Calls `haBridge.deregisterClient(ws)` on close
- [x] 4.3 Update `package.json` `"start"` script to use the custom server entry:
  `"start": "node ./build/server/server.js"`
- [x] 4.4 Ensure the custom server file is included in the production build (`vite.server.config.ts` added, `build` script updated)

## 5. Development — Vite Plugin for WS Upgrade

- [x] 5.1 Add a Vite plugin in `vite.config.ts` that hooks `configureServer(server)` and attaches the same `upgrade` listener to Vite's `httpServer` for the `/api/ha/ws` path — ensuring it fires before Vite's HMR WebSocket handler

## 6. Bridge Lifecycle — Tied to HA Config

- [x] 6.1 Update `POST /api/ha/config` route: after saving credentials, call `haBridge.connect(host, token)`
- [x] 6.2 Update `DELETE /api/ha/config` route: call `haBridge.disconnect()` before deleting config
- [x] 6.3 Update the server startup (in `app/server.ts`): on process start, read `ha_config` from DB and call `haBridge.connect(...)` if a config row exists — so the bridge auto-starts after server restart

## 7. Client — `useHAStore` Zustand Store

- [x] 7.1 Create `app/store/useHAStore.ts` with state: `connectionStatus: HAConnectionStatus`, `states: Record<string, HAEntityState>`
- [x] 7.2 Implement actions: `setSnapshot(states)`, `applyStateChange(entityId, state)`, `setConnectionStatus(status)`
- [x] 7.3 No persistence (no `localStorage` / no SQLite) — state is always rebuilt from the live WS connection

## 8. Client — Browser WebSocket Hook

- [x] 8.1 Create `app/hooks/useHAWebSocket.ts` — a hook that:
  - Opens `new WebSocket("ws://[host]/api/ha/ws")` relative to the current page origin
  - On `message`: parses `HABridgeMessage`, dispatches to `useHAStore.setSnapshot` or `useHAStore.applyStateChange`
  - On `open`: calls `useHAStore.setConnectionStatus("connected")`
  - On `close` / `error`: calls `useHAStore.setConnectionStatus("disconnected")`
  - Cleans up on unmount (closes WS)
- [x] 8.2 Mount `useHAWebSocket()` once in `app/routes/home.tsx` so it is active for the lifetime of the app

## 9. Client — `useHAEntity` Selector Hook

- [x] 9.1 Create `app/hooks/useHAEntity.ts` — exports `function useHAEntity(entityId: string | null): HAEntityState | null` that reads from `useHAStore`; returns `null` if `entityId` is null or not yet in the store

## 10. Settings Panel — Connection Status

- [x] 10.1 Update `app/components/HASettingsPanel.tsx` to subscribe to `useHAStore(s => s.connectionStatus)` and display a live status badge:
  - 🟢 Connected
  - 🟡 Connecting
  - 🔴 Disconnected / Error
- [x] 10.2 Show entity count (number of keys in `useHAStore(s => s.states)`) when connected

## 11. Validation

- [x] 11.1 Run `pnpm typecheck` — fix all TypeScript errors
- [ ] 11.2 Manual test (dev): configure HA, verify Settings panel shows "Connected" and entity count
- [ ] 11.3 Manual test (dev): toggle a light in HA — verify `useHAStore.states` updates within ~500ms (check via React DevTools or a temporary debug overlay)
- [ ] 11.4 Manual test: kill HA server, verify Settings panel shows "Disconnected"; restart HA, verify automatic reconnect and "Connected" badge
- [ ] 11.5 Manual test: delete HA config (Disconnect button), verify bridge tears down cleanly and Settings panel shows "Not connected"
- [ ] 11.6 Manual test (prod build): run `pnpm build && pnpm start`, verify WS connection works with the custom server entry
