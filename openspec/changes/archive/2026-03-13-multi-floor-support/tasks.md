## 1. Data Model & Types

- [x] 1.1 Add `Floor` type to `app/store/types.ts` with fields: `id`, `name`, `level` (integer), `floorHeight` (meters, default 2.8)
- [x] 1.2 Add `StaircaseOpening` type to `app/store/types.ts` with fields: `id`, `floorId`, `position: Point2D`, `width`, `depth`, `rotation`
- [x] 1.3 Add `floorId: string` field to `CornerNode`, `WallSegment`, and `Room` types
- [x] 1.4 Update `FloorplanImage` type to include `floorId: string`
- [x] 1.5 Update `HistoryEntry` to include `staircaseOpenings` alongside `corners` and `walls`
- [x] 1.6 Update `FloorplanState` interface: add `floors: Floor[]`, `currentFloorId: string`, `staircaseOpenings: Record<string, StaircaseOpening>`, and new action signatures for floor management and staircase CRUD

## 2. Database Schema & Migration

- [x] 2.1 Add `floors` table to `app/db/schema.ts` with columns: `id`, `planId` (FK), `name`, `level`, `floorHeight`
- [x] 2.2 Add `staircase_openings` table to `app/db/schema.ts` with columns: `id`, `floorId` (FK), `x`, `y`, `width`, `depth`, `rotation`
- [x] 2.3 Add `floorId` column (FK to floors) to `corners`, `walls`, and `floorplan_images` tables
- [x] 2.4 Remove the unique constraint on `floorplan_images.plan_id` (now one image per floor, not per plan)
- [x] 2.5 Generate and run Drizzle migration; write a data migration that creates a default "Ground Floor" for each existing plan and backfills `floorId` on all existing corners, walls, and floorplan images

## 3. Zustand Store — Floor Management

- [x] 3.1 Add floor state fields to the store: `floors`, `currentFloorId`, `staircaseOpenings`
- [x] 3.2 Implement `addFloor()` action: creates a new floor with auto-incremented level and name, sets it as active
- [x] 3.3 Implement `removeFloor(floorId)` action: deletes floor and all associated corners, walls, rooms, floorplan image, and staircase openings; prevents deleting the last floor; switches to nearest remaining floor
- [x] 3.4 Implement `updateFloor(floorId, patch)` action: update floor name and floorHeight
- [x] 3.5 Implement `setCurrentFloor(floorId)` action: switches active floor, cancels any in-progress drawing, clears all selections
- [x] 3.6 Ensure `newPlan()` creates a default "Ground Floor" (level 0, floorHeight 2.8m) and sets it as current
- [x] 3.7 Update `addCorner()` and `addWall()` to tag new entities with `currentFloorId`

## 4. Zustand Store — Staircase Openings

- [x] 4.1 Implement `addStaircaseOpening(position)` action: creates a staircase opening on the current floor with default dimensions (1.0m × 2.5m, rotation 0)
- [x] 4.2 Implement `removeStaircaseOpening(id)` action
- [x] 4.3 Implement `updateStaircaseOpening(id, patch)` action: update position, width, depth, rotation
- [x] 4.4 Implement `selectStaircaseOpening(id)` action and add `selectedStaircaseId` to store state
- [x] 4.5 Add `"staircase"` to the `BuildTool` union type

## 5. Room Detection Update

- [x] 5.1 Update `detectRooms()` in `app/store/roomDetection.ts` to run per-floor: filter corners and walls by `floorId`, tag resulting rooms with `floorId`
- [x] 5.2 Update the Zustand subscription that triggers room detection to re-detect only the affected floor(s)

## 6. Persistence — Save/Load

- [x] 6.1 Update `app/routes/api.plans.save.ts` to accept and persist floors, per-floor corners/walls/floorplan images, and staircase openings
- [x] 6.2 Update `app/db/queries.ts` `loadPlanById()` to load all floors, per-floor geometry, and staircase openings; reconstruct the full state
- [x] 6.3 Update `savePlan()` and `loadPlan()` store actions to handle the new multi-floor payload
- [x] 6.4 Update `hydratePlan()` to accept and populate floors, per-floor data, and staircase openings

## 7. 2D Scene — Floor-Scoped Rendering

- [x] 7.1 Update `BuildScene.tsx` to filter rendered corners, walls, rooms, and floorplan image by `currentFloorId`
- [x] 7.2 Update `GroundPlane` click handlers to use `currentFloorId` when creating corners/walls
- [x] 7.3 Update wall geometry utils to filter neighbor walls by `floorId` when computing mitered corners
- [x] 7.4 Add `Staircase2D` component: renders staircase openings on the active floor as dashed rectangles with "Stairs" label and direction indicator
- [x] 7.5 Add click/drag handlers for staircase openings in 2D (select, move, delete)

## 8. 3D Scene — Multi-Floor Preview

- [x] 8.1 Update `PreviewScene.tsx` to iterate all floors sorted by level, computing cumulative Y-offset from floor heights
- [x] 8.2 Render each floor's walls at the correct Y-offset using a group transform
- [x] 8.3 Add `FloorPlate3D` component: renders a thin horizontal slab at each floor boundary (except ground level)
- [x] 8.4 Add staircase cutouts to floor plates and a simple stair placeholder mesh (sloped plane) connecting floors
- [x] 8.5 Update `Room3D` labels to render at the correct Y-offset per floor
- [x] 8.6 Update camera auto-positioning to encompass the total building height (all floors)
- [x] 8.7 Center all floors on the same XZ origin based on the combined bounding box

## 9. UI — Floor Selector & Toolbar

- [x] 9.1 Add `FloorSelector` component to `Toolbar.tsx`: lists floors ordered by level (descending), highlights active floor, allows click to switch
- [x] 9.2 Add "Add Floor" button to the floor selector
- [x] 9.3 Add "Delete Floor" button with confirmation (disabled if only one floor)
- [x] 9.4 Add staircase tool button to the build mode toolbar
- [x] 9.5 Update the stats display in the toolbar to show current floor name

## 10. UI — Properties Panel

- [x] 10.1 Add `FloorProperties` section to `PropertiesPanel.tsx`: edit floor name and floor-to-floor height
- [x] 10.2 Add `StaircaseProperties` section: edit width, depth, rotation, and position of selected staircase opening
- [x] 10.3 Show floor name context on wall/corner/room property sections (read-only indicator)
