## Context

Wall components (light, sensor, outlet, switch) are fully modeled in the store and database but have no visual rendering in either 2D or 3D. Additionally, lights and sensors need to be placeable on room ceilings. This change adds wall component rendering to both modes, introduces room-level ceiling components with a new data model and persistence layer, and makes wall component properties editable.

## Goals / Non-Goals

- Goals:
  - Render each of the 4 wall component types with distinct colors in 2D
  - Render each of the 4 wall component types as recognizable 3D shapes in 3D preview
  - Make wall component offset, elevation, and face editable in the properties panel (matching the opening editing pattern)
  - Support lights and sensors as room ceiling components with 2D position within the room polygon
  - Render room components as colored circles in 2D and as 3D shapes on the ceiling in 3D preview
  - Persist room components across room re-detection using a polygon hash key
  - Follow existing theme color conventions (light + dark palettes)
- Non-Goals:
  - Drag-to-move on canvas — all repositioning uses properties panel NumberInputs
  - Editable component labels on canvas
  - Component collision detection or overlap prevention
  - Outlets and switches on ceilings (only lights and sensors)

## Decisions

### Wall Component 2D Rendering
- Decision: Render wall components as small filled circles at the component's `offset` along the wall center line, colored by type. No text labels on canvas to keep the 2D view clean.
- Alternatives considered:
  - Icons/sprites per type — adds asset management complexity for minimal gain at the typical zoom level
  - Rectangles/squares — circles are simpler and more distinguishable at small sizes

### Wall Component 3D Rendering
- Decision: Render simple geometric primitives per component type, positioned on the wall face at the correct `offset` and `elevation`. Shapes:
  - **light**: Small sphere (emissive glow)
  - **sensor**: Small octahedron (diamond-like)
  - **outlet**: Small box (rectangular plate)
  - **switch**: Small box, slightly taller than wide (toggle plate)
- Alternatives considered:
  - GLTF models — unnecessary complexity for v1, no asset pipeline exists
  - 2D sprites in 3D space — less immersive in 3D preview

### Wall Component Positioning
- Decision: Use the existing `computeWallGeometry()` output (`start`, `dirX`, `dirY`, `normX`, `normY`, `thickness`) to place components. The `offset` determines position along the wall direction from the start point. The `face` ("left"/"right") determines which side of the wall the component sits on (offset by half-thickness along the normal). The `elevation` maps directly to the Y coordinate in 3D.
- In 2D, ignore `elevation` and `face` — just project the `offset` along the wall center line.

### Wall Component Editing
- Decision: Swap the existing `ReadonlyField` displays for offset, elevation, and face to `NumberInput` fields and a `<select>` dropdown, matching the exact pattern used by `OpeningEditor` in the properties panel. The store's `updateComponent` action already supports partial patches.
- No new store logic needed; only UI changes in `PropertiesPanel.tsx`.

### Room Component Data Model
- Decision: Add a `RoomComponent` interface with fields: `id`, `type` ("light" | "sensor"), `label`, `x`, `y` (position in floorplan meters, within the room polygon), and optional `meta`. Add a `components: RoomComponent[]` array to the `Room` interface.
- Alternatives considered:
  - Separate top-level entity outside Room — adds complexity; components are conceptually owned by rooms.
  - Reuse `WallComponent` type — wall components have `offset`/`elevation`/`face` fields that don't apply to ceiling placement; a separate type is cleaner.

### Room Component Persistence
- Decision: Create a `room_components` DB table with a `roomKey` column that stores the sorted-corner-IDs hash (e.g., `"corner1,corner2,corner3"`) instead of the room UUID. This allows components to survive room re-detection, since room IDs change whenever walls are modified but the polygon hash stays stable as long as the room shape is preserved.
- The `detectRooms` function in `roomDetection.ts` already computes `sortedKey = [...cycle].sort().join(",")` and uses it to match existing rooms. Room components will be carried over using the same key.
- On save, room components are written with the room's polygon hash. On load, they are attached to rooms during plan hydration by matching the hash.
- Alternatives considered:
  - FK to room ID — room IDs are ephemeral and change on re-detection, components would be lost
  - Persist rooms to DB — larger scope, not needed for this feature

### Room Component 2D Rendering
- Decision: Render room components as small colored circles at their `(x, y)` position within the room polygon, matching the wall component marker style. Same color tokens per type (light = yellow/amber, sensor = teal/cyan).
- Position is absolute in floorplan coordinates, not relative to room centroid, so the rendering is straightforward.

### Room Component 3D Rendering
- Decision: Render room components on the ceiling surface (Y = wall height for that floor) at their `(x, z)` position. Same 3D shape conventions as wall components: sphere for light (emissive), octahedron for sensor. Components face downward (hanging from ceiling).

### Room Component Properties Panel
- Decision: Add a "Ceiling Components" section to `RoomProperties` in the properties panel. Include "Add Light" and "Add Sensor" buttons (matching the wall component add buttons pattern). Each component shows its label, type icon, X/Y position as `NumberInput` fields, and a remove button. X/Y inputs are bounded to the room's bounding box for simplicity (exact polygon containment is a non-goal for v1).

### Theme Integration
- Decision: Add 4 color tokens to `ThemeColors` (one per component type) used in both wall and room component rendering across 2D and 3D. This follows the existing pattern of separate color tokens per visual element.

## Risks / Trade-offs

- Walls with many components may look cluttered in 2D — mitigated by using small markers (radius ~0.06m) that are visible but unobtrusive
- 3D shapes are simple primitives, not realistic — acceptable for v1; can be upgraded to detailed meshes later
- Room component positions are bounded to the room bounding box, not the exact polygon — a component could technically be placed slightly outside an irregular room shape. Acceptable for v1.
- Room components are lost if a room's corner set changes (e.g., wall deletion reshapes the room) — this is an inherent limitation of the polygon-hash approach but matches user expectations (room no longer exists in the same shape)

## Open Questions

- None.
