## 1. Theme Colors

- [x] 1.1 Add 4 component color tokens to `ThemeColors` interface in `app/hooks/useThemeColors.ts` (`componentLight`, `componentSensor`, `componentOutlet`, `componentSwitch`)
- [x] 1.2 Add dark theme values to `darkColors`
- [x] 1.3 Add light theme values to `lightColors`

## 2. Wall Component 2D Rendering

- [x] 2.1 Create `Component2D.tsx` in `app/scene/` — renders a colored circle at the component's offset along the wall center line using `computeWallGeometry()` output
- [x] 2.2 Integrate `Component2D` into `Wall2D.tsx` — iterate over `wall.components` (skip if wall is invisible), render a `<Component2D>` for each

## 3. Wall Component 3D Rendering

- [x] 3.1 Create `Component3D.tsx` in `app/scene/` — renders a type-specific 3D shape (sphere/octahedron/box) at the component's offset, elevation, and face using `computeWallGeometry()` output
- [x] 3.2 Integrate `Component3D` into `Wall3D.tsx` — iterate over `wall.components` (skip if wall is invisible), render a `<Component3D>` for each

## 4. Wall Component Property Editing

- [x] 4.1 In `PropertiesPanel.tsx`, replace `ReadonlyField` for wall component offset with `NumberInput` (min=0, max=wallLength, step=0.05)
- [x] 4.2 Replace `ReadonlyField` for wall component elevation with `NumberInput` (min=0, max=wallHeight, step=0.05)
- [x] 4.3 Replace wall component face text display with a `<select>` dropdown (left/right), matching the opening face pattern
- [x] 4.4 Wire up `updateComponent` calls with `pushHistory()` before mutations

## 5. Room Component Data Model

- [x] 5.1 Add `RoomComponent` interface to `app/store/types.ts` with fields: `id`, `type` ("light" | "sensor"), `label`, `x`, `y`, optional `meta`
- [x] 5.2 Add `components: RoomComponent[]` to the `Room` interface
- [x] 5.3 Initialize `components: []` in room detection output (`app/store/roomDetection.ts`)
- [x] 5.4 Carry over existing room components by polygon hash during re-detection

## 6. Room Component Persistence

- [x] 6.1 Add `room_components` table to `app/db/schema.ts` with columns: `id`, `roomKey` (sorted corner IDs), `floorId`, `type`, `label`, `x`, `y`, `meta`
- [x] 6.2 Run `pnpm db:push` to apply schema change
- [x] 6.3 Add room component loading in `app/db/queries.ts` — load by `floorId`, attach to rooms by matching `roomKey` to sorted corner IDs
- [x] 6.4 Add room component saving in `app/routes/api.plans.save.ts` — write room components with the room's polygon hash as `roomKey`

## 7. Room Component Store Actions

- [x] 7.1 Add `addRoomComponent(roomId, component)` action to `useFloorplanStore` — generates UUID, defaults position to room centroid
- [x] 7.2 Add `removeRoomComponent(roomId, componentId)` action
- [x] 7.3 Add `updateRoomComponent(roomId, componentId, patch)` action
- [x] 7.4 Add action type signatures to `FloorplanState` interface in `types.ts`

## 8. Room Component 2D Rendering

- [x] 8.1 Create `RoomComponent2D.tsx` in `app/scene/` — renders a colored circle at the component's `(x, y)` position
- [x] 8.2 Integrate into `Room2D.tsx` or `BuildScene.tsx` — render `<RoomComponent2D>` for each room component

## 9. Room Component 3D Rendering

- [x] 9.1 Create `RoomComponent3D.tsx` in `app/scene/` — renders type-specific 3D shape at `(x, ceilingHeight, z)`, facing downward
- [x] 9.2 Integrate into `Room3D.tsx` or `PreviewScene.tsx` — render `<RoomComponent3D>` for each room component

## 10. Room Component Properties Panel

- [x] 10.1 Add "Ceiling Components" section to `RoomProperties` in `PropertiesPanel.tsx`
- [x] 10.2 Add "Add Light" and "Add Sensor" buttons (matching existing wall component add buttons pattern)
- [x] 10.3 Display each component with label, type icon, X/Y `NumberInput` fields, and remove button
- [x] 10.4 Wire up `addRoomComponent`, `updateRoomComponent`, `removeRoomComponent` with `pushHistory()` before mutations

## 11. Verification

- [x] 11.1 Run `pnpm typecheck` and fix any type errors
- [ ] 11.2 Manually verify: wall components render as colored circles in 2D at correct offsets
- [ ] 11.3 Manually verify: wall components render as 3D shapes in 3D preview at correct offset/elevation/face
- [ ] 11.4 Manually verify: wall component offset/elevation/face are editable via properties panel
- [ ] 11.5 Manually verify: room ceiling components can be added via properties panel
- [ ] 11.6 Manually verify: room components render as circles in 2D at correct positions
- [ ] 11.7 Manually verify: room components render on ceiling in 3D preview
- [ ] 11.8 Manually verify: room components persist across save/load and survive room re-detection
