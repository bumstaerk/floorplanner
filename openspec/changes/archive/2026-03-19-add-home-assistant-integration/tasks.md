# Tasks: Add Home Assistant Integration — Phase 1

## 1. Database Schema

- [x] 1.1 Add `haConfig` table to `app/db/schema.ts` with columns: `id` (integer PK), `host` (text), `token` (text), `updatedAt` (integer)
- [x] 1.2 Add `haEntityId` (nullable text) column to `wallComponents` table in `app/db/schema.ts`
- [x] 1.3 Add `haEntityId` (nullable text) column to `roomComponents` table in `app/db/schema.ts`
- [x] 1.4 Run `pnpm db:push` to apply schema changes to the local SQLite DB

## 2. TypeScript Types

- [x] 2.1 Add `haEntityId: string | null` field to `WallComponent` interface in `app/store/types.ts`
- [x] 2.2 Add `haEntityId: string | null` field to `RoomComponent` interface in `app/store/types.ts`
- [x] 2.3 Add new `HAEntity` interface to `app/store/types.ts`: `{ entityId: string; friendlyName: string; domain: string; state: string }`

## 3. DB Queries

- [x] 3.1 Add `getHAConfig()` query in `app/db/queries.ts` — returns `{ host, token } | null`
- [x] 3.2 Add `setHAConfig(host, token)` query — upserts the single `ha_config` row
- [x] 3.3 Add `deleteHAConfig()` query — removes the `ha_config` row
- [x] 3.4 Update `loadPlanById()` in `app/db/queries.ts` to read `ha_entity_id` from `wall_components` and `room_components` and map it to `haEntityId` on the returned objects
- [x] 3.5 Update the save logic in `app/routes/api.plans.save.ts` to persist `haEntityId` when inserting wall components and room components

## 4. API Routes

- [x] 4.1 Create `app/routes/api.ha.config.ts` — handles `GET` (returns `{ configured: boolean }`), `POST` (saves host + token), `DELETE` (removes config); register in `app/routes.ts`
- [x] 4.2 Create `app/routes/api.ha.entities.ts` — handles `GET`; reads config from DB, fetches `${host}/api/states` with `Authorization: Bearer ${token}`, maps response to `HAEntity[]`; returns `[]` if not configured, `502` if HA unreachable; register in `app/routes.ts`

## 5. Zustand Store

- [x] 5.1 Ensure `addComponent` action in `useFloorplanStore.ts` initialises `haEntityId: null` on new `WallComponent` objects
- [x] 5.2 Ensure `addRoomComponent` action initialises `haEntityId: null` on new `RoomComponent` objects
- [x] 5.3 Add `updateComponentHAEntity(wallId: string, componentId: string, entityId: string | null)` action — patches `haEntityId` on the matching component without pushing history
- [x] 5.4 Add `updateRoomComponentHAEntity(roomId: string, componentId: string, entityId: string | null)` action — same for room components
- [x] 5.5 Verify `hydratePlan()` correctly populates `haEntityId` on components when loading a saved plan

## 6. HA Settings UI

- [x] 6.1 Create `app/components/HASettingsPanel.tsx` — collapsible panel section with: connection status badge, host URL input, token input (masked, type="password"), Save button, Test Connection button (calls `api/ha/entities` and shows success/error), Disconnect button
- [x] 6.2 Add `<HASettingsPanel />` to `app/components/PropertiesPanel.tsx` below `PlanSettings` and above `ModelThemeEditor`

## 7. Entity Picker UI

- [x] 7.1 Create `app/components/HAEntityPicker.tsx` — a controlled component accepting `value: string | null`, `onChange: (entityId: string | null) => void`; fetches entity list from `api/ha/entities` on mount; renders a text input with filtered dropdown; shows `entityId` and `friendlyName`; includes a clear button
- [x] 7.2 Add `<HAEntityPicker>` to the `WallComponentEditor` sub-component in `PropertiesPanel.tsx`, calling `updateComponentHAEntity` on change
- [x] 7.3 Add `<HAEntityPicker>` to the `RoomComponentEditor` sub-component in `PropertiesPanel.tsx`, calling `updateRoomComponentHAEntity` on change
- [x] 7.4 Show the currently bound entity ID (and friendly name if available) in the component editor even when the picker is collapsed/closed

## 8. Validation

- [x] 8.1 Run `pnpm typecheck` — fix all TypeScript errors introduced by new fields and routes
- [ ] 8.2 Manual test: configure HA connection, verify entities load in picker, bind an entity to a component, save plan, reload page, verify binding persists
- [ ] 8.3 Manual test: enter invalid HA host — verify graceful error in Settings panel and empty entity list (no crash)
- [ ] 8.4 Manual test: disconnect HA — verify entity pickers show empty state and existing bindings are preserved in the plan data
