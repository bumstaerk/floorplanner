# Change: Add visual rendering and management of wall and room components

## Why
Wall components (light, sensor, outlet, switch) can be added and managed via the properties panel, but they have zero visual representation on the canvas. Additionally, lights and sensors need to be placeable on room ceilings for realistic building layouts. Users cannot see where components are placed in either 2D build mode or 3D preview mode, and room-level ceiling components are not supported at all.

## What Changes
- Render wall components as colored markers in 2D build mode (each type gets a distinct color)
- Render wall components as small 3D shapes in 3D preview mode (type-specific geometry)
- Make wall component offset, elevation, and face editable via NumberInput in the properties panel (matching the opening editing pattern)
- Add room component data model (`RoomComponent` type with `x`, `y` position within room polygon)
- Add `room_components` DB table keyed by room polygon hash for persistence across re-detection
- Add room component store actions (add, remove, update)
- Render room components as colored circles in 2D build mode
- Render room components on the ceiling surface in 3D preview mode
- Add room component management UI in the properties panel (add light/sensor, edit position via NumberInput)
- Add component-specific theme colors to the `ThemeColors` system (light and dark palettes)

## Impact
- Affected specs: new `wall-component-rendering` capability, new `room-component-rendering` capability
- Affected code:
  - `app/store/types.ts` — add `RoomComponent` interface, extend `Room` with `components` array
  - `app/store/useFloorplanStore.ts` — add room component actions, preserve components through re-detection
  - `app/store/roomDetection.ts` — carry over room components by polygon hash
  - `app/db/schema.ts` — add `room_components` table
  - `app/db/queries.ts` — load room components
  - `app/routes/api.plans.save.ts` — save room components
  - `app/scene/Wall2D.tsx` — render wall component markers
  - `app/scene/Wall3D.tsx` — render 3D wall component shapes
  - `app/scene/Room2D.tsx` — render room component markers
  - `app/scene/Room3D.tsx` — render ceiling components in 3D
  - `app/components/PropertiesPanel.tsx` — editable wall component fields, room component management UI
  - `app/hooks/useThemeColors.ts` — add component color tokens
