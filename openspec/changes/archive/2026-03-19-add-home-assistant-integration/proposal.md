# Change: Add Home Assistant Integration — Phase 1 (Connection & Entity Mapping)

## Why

The floorplan editor currently models a static smart home layout. To become a live smart home
dashboard, it needs to connect to Home Assistant, discover real devices, and let users bind
their floorplan components (lights, sensors, switches, outlets) to real HA entities. This is the
foundational layer that all subsequent real-time state and control features depend on.

## What Changes

- **New DB columns**: `haEntityId` (nullable string) on `WallComponent` and `RoomComponent`
- **New DB table**: `ha_config` — stores HA host URL and Long-Lived Access Token server-side
- **New API routes**:
  - `GET api/ha/config` — returns whether HA is configured (no token in response)
  - `POST api/ha/config` — save/update HA host + token
  - `DELETE api/ha/config` — remove HA config
  - `GET api/ha/entities` — proxies HA REST API `/api/states`, returns flat entity list
- **New Zustand slice**: `haEntityId` field on `WallComponent` and `RoomComponent` types
- **Store actions**: `updateComponentHAEntity(wallId, componentId, entityId)` and `updateRoomComponentHAEntity(roomId, componentId, entityId)`
- **UI — Settings Panel**: New "Home Assistant" section in the PropertiesPanel (or a dedicated modal) to enter HA host and token, test connection, and see connection status
- **UI — Entity Picker**: In WallComponent and RoomComponent editors in the PropertiesPanel, add a searchable entity dropdown that lists all HA entities and lets users bind one to the component
- **Persistence**: `haEntityId` is saved/loaded with plan data via the existing save/load pipeline

## Non-Goals (this phase)

- Real-time WebSocket state subscription (Phase 2)
- Visual state reflection in 3D (Phase 3)
- Write-back / controlling devices (Phase 4)
- Room-to-HA-area linking (Phase 5)

## Impact

- **Affected specs**: `ha-connection`, `component-model` (new capabilities)
- **Affected code**:
  - `app/db/schema.ts` — new `haConfig` table, new columns on wall/room component tables
  - `app/db/queries.ts` — HA config CRUD, load/save component entity IDs
  - `app/store/types.ts` — extend `WallComponent`, `RoomComponent`
  - `app/store/useFloorplanStore.ts` — new actions for entity binding
  - `app/routes/` — four new HA API routes
  - `app/routes/api.plans.save.ts` — persist `haEntityId`
  - `app/db/queries.ts` `loadPlanById` — hydrate `haEntityId`
  - `app/components/PropertiesPanel.tsx` — entity picker UI in component editors
  - New component: `app/components/HASettingsPanel.tsx`
