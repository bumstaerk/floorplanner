# Spec Delta: ha-realtime-state

## ADDED Requirements

### Requirement: Server-Side HA WebSocket Bridge
The system SHALL maintain a single persistent outbound WebSocket connection to the configured
Home Assistant instance within the Node.js server process. This connection SHALL be shared
across all connected browser clients.

#### Scenario: Bridge auto-starts on server boot
- **WHEN** the server starts and a valid `ha_config` row exists in the database
- **THEN** the bridge connects to `ws://${host}/api/websocket` and completes the HA auth handshake
- **AND** calls `get_states` and `subscribe_events` for `state_changed`

#### Scenario: Bridge connects after HA config is saved
- **WHEN** the user saves HA credentials via `POST /api/ha/config`
- **THEN** the bridge initiates a connection to HA immediately (without requiring a server restart)

#### Scenario: Bridge disconnects when HA config is deleted
- **WHEN** the user clicks "Disconnect" and `DELETE /api/ha/config` is called
- **THEN** the bridge closes the HA WebSocket connection and cancels any pending reconnect timer

---

### Requirement: Automatic Reconnection
The bridge SHALL automatically reconnect to HA after an unexpected disconnect using
exponential backoff (1s, 2s, 4s, 8s, 16s, 30s cap), retrying indefinitely until a
connection succeeds or `disconnect()` is explicitly called.

#### Scenario: HA server restarts
- **WHEN** the HA WebSocket closes unexpectedly
- **THEN** the bridge attempts reconnect after 1 second
- **AND** doubles the interval on each failure up to a 30-second cap
- **AND** resets the interval to 1 second on the next successful connection

---

### Requirement: Browser-Facing WebSocket Endpoint
The system SHALL expose a WebSocket endpoint at `/api/ha/ws` that browser clients connect to
in order to receive live HA state updates.

#### Scenario: Client receives full state snapshot on connect
- **WHEN** a browser client connects to `/api/ha/ws`
- **THEN** the server immediately sends an `ha_snapshot` message containing all currently
  known entity states as `Record<entityId, HAEntityState>`

#### Scenario: Client receives incremental state updates
- **WHEN** HA emits a `state_changed` event
- **THEN** the bridge broadcasts an `ha_state_changed` message to all connected browser clients
  containing the `entityId` and the new `HAEntityState`

#### Scenario: Multiple browser clients
- **WHEN** multiple browser tabs or windows have the floorplan open
- **THEN** all receive the same state updates from the single bridge connection

---

### Requirement: Client-Side HA State Store
The browser SHALL maintain a Zustand store (`useHAStore`) that holds the full current state
of all HA entities as a flat map `Record<entityId, HAEntityState>`. This store SHALL be the
single source of truth for HA state on the client.

#### Scenario: Store initialises from snapshot
- **WHEN** the browser WebSocket receives an `ha_snapshot` message
- **THEN** `useHAStore.states` is replaced with the snapshot data
- **AND** `connectionStatus` is set to `"connected"`

#### Scenario: Store applies incremental update
- **WHEN** the browser WebSocket receives an `ha_state_changed` message
- **THEN** `useHAStore.states[entityId]` is updated to the new state
- **AND** all React components reading that entity re-render with the new value

#### Scenario: Store reflects disconnection
- **WHEN** the browser WebSocket closes or errors
- **THEN** `connectionStatus` is set to `"disconnected"`
- **AND** existing `states` are retained (stale but visible) until a new snapshot arrives

---

### Requirement: `useHAEntity` Selector Hook
The system SHALL provide a `useHAEntity(entityId: string | null)` React hook that returns the
current `HAEntityState` for a given entity ID, or `null` if the entity is unknown or the ID
is null. This hook is the primary consumer API for Phase 3 visual components.

#### Scenario: Entity exists in store
- **WHEN** `useHAEntity("light.living_room")` is called and the entity is in the store
- **THEN** it returns the `HAEntityState` and re-renders when the state changes

#### Scenario: Entity not yet loaded
- **WHEN** `useHAEntity("light.living_room")` is called before the snapshot arrives
- **THEN** it returns `null`

#### Scenario: Null entity ID
- **WHEN** `useHAEntity(null)` is called
- **THEN** it returns `null` without subscribing to any store updates
