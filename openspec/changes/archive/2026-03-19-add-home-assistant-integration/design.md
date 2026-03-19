# Design: Home Assistant Integration — Phase 1

## Context

The floorplan editor stores all state in a single Zustand store (`useFloorplanStore`) and
persists it via a SQLite DB through Drizzle ORM. Wall components and room components already
exist as typed objects (`WallComponent`, `RoomComponent`) with fields like `type`, `label`,
`offset`, `elevation`. We need to extend these with an optional HA entity binding, add secure
server-side credential storage, and add proxy API routes that front the HA REST API.

## Goals / Non-Goals

**Goals:**
- Securely store HA credentials server-side only (never in the browser or Zustand)
- Proxy HA REST API from a server route to avoid CORS and keep the token hidden
- Let users search and bind any HA entity to any floorplan component
- Persist entity bindings with the plan (save/load roundtrip)

**Non-Goals:**
- WebSocket / live state (Phase 2)
- Any visual change in the 3D scene based on entity state (Phase 3)
- Sending commands to HA (Phase 4)

## Decisions

### 1. Credential Storage — DB table, not environment variable

**Decision**: Store the HA host URL and Long-Lived Access Token in a new `ha_config` SQLite
table (single row, `id = 1`), readable only server-side via Drizzle.

**Rationale**: The project already uses SQLite for all persistence. An env variable would
require a deployment config change for every user. A DB row can be updated at runtime via the
Settings panel without restarting the server. The token never leaves the server — client-side
code only knows whether HA is configured (boolean) and which entities exist (names/IDs).

**Alternatives considered**:
- *Environment variable*: Requires redeploy to change. Not suitable for a user-configurable tool.
- *localStorage*: Exposes the token in the browser. Rejected for security reasons.

### 2. Entity Proxy — React Router resource route

**Decision**: Implement `GET api/ha/entities` as a React Router `loader` route that fetches
`${haHost}/api/states` server-side using the stored token and returns a simplified entity list
`Array<{ entityId, friendlyName, domain, state }>`.

**Rationale**: Keeps credentials server-side, handles CORS (HA may restrict origins), and
lets us filter/sort the entity list before sending it to the client. The client fetches this
once when the Settings panel or entity picker opens.

### 3. Entity Binding — Field on component, not a separate table

**Decision**: Add `haEntityId: string | null` directly to the `WallComponent` and
`RoomComponent` interfaces (and the corresponding DB columns on `wall_components` and
`room_components`).

**Rationale**: Entity binding is a 1:1 property of a component — one component binds to at
most one HA entity. A join table would add complexity with no benefit. Nullable field follows
the existing pattern for optional component properties.

### 4. Entity Picker UI — Searchable dropdown in PropertiesPanel

**Decision**: Add an entity picker to the existing `WallComponentEditor` and
`RoomComponentEditor` sub-components in `PropertiesPanel.tsx`. The picker is a controlled
`<input>` with a filtered dropdown list fetched from `api/ha/entities`.

**Rationale**: Keeps entity binding co-located with the component editing experience. Users
already open the PropertiesPanel to edit components; the entity binding fits naturally there.

The entity list is fetched once and cached in local component state (or a small React context)
for the duration of the panel being open. No global Zustand state needed for the entity
catalogue — only the bound `haEntityId` string lives in the store.

### 5. Settings Panel — Inline in PropertiesPanel footer

**Decision**: Add a collapsible "Home Assistant" section at the bottom of the PropertiesPanel
(alongside the existing `PlanSettings` and `ModelThemeEditor` sections) rather than a separate
modal.

**Rationale**: Consistent with the existing panel-section pattern. Avoids a new modal
abstraction. The section shows: connection status badge, host input, token input (masked),
"Save" and "Test" buttons, and a "Disconnect" button.

## Data Flow

```
User opens PropertiesPanel
  → "Home Assistant" section mounts
  → GET api/ha/config  →  { configured: true/false }
  → User enters host + token, clicks Save
  → POST api/ha/config  →  stored in ha_config table

User edits a WallComponent
  → Entity picker renders
  → GET api/ha/entities  →  server fetches HA /api/states with stored token
  → User selects entity
  → updateComponentHAEntity(wallId, componentId, entityId)  →  Zustand store
  → On Save Plan: entityId persisted in wall_components.ha_entity_id

Plan Load
  → loadPlanById() reads ha_entity_id from wall_components / room_components
  → hydratePlan() populates WallComponent.haEntityId / RoomComponent.haEntityId
```

## DB Schema Changes

```ts
// New table
export const haConfig = sqliteTable("ha_config", {
  id: integer("id").primaryKey(),           // always 1
  host: text("host").notNull(),             // e.g. "http://192.168.1.100:8123"
  token: text("token").notNull(),           // Long-Lived Access Token
  updatedAt: integer("updated_at").notNull(),
});

// New columns (wall_components, room_components)
haEntityId: text("ha_entity_id"),           // nullable, e.g. "light.living_room"
```

## TypeScript Interface Changes

```ts
// app/store/types.ts

interface WallComponent {
  // ... existing fields ...
  haEntityId: string | null;   // ADD
}

interface RoomComponent {
  // ... existing fields ...
  haEntityId: string | null;   // ADD
}

// New type for the entity picker
interface HAEntity {
  entityId: string;
  friendlyName: string;
  domain: string;
  state: string;
}
```

## API Route Shapes

```
GET  /api/ha/config
  → 200 { configured: boolean }

POST /api/ha/config
  body: { host: string, token: string }
  → 200 { ok: true }

DELETE /api/ha/config
  → 200 { ok: true }

GET  /api/ha/entities
  → 200 HAEntity[]           (empty array if not configured)
  → 502 { error: "..." }     (if HA unreachable)
```
