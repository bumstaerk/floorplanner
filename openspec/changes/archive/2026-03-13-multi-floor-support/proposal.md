## Why

The floorplanner currently supports only a single floor per plan, which limits its usefulness for multi-story buildings. Users need the ability to design houses and buildings with multiple floors, each with its own floorplan image, walls, and rooms — and see them stacked in 3D preview.

## What Changes

- Add a **floor management system** to the editor: create, rename, reorder, and delete floors within a plan
- Each floor stores its own set of corners, walls, rooms, and an optional background floorplan image
- In **2D build mode**, users switch between floors via a floor selector; only the active floor's geometry is editable
- In **3D preview mode**, all floors render stacked vertically, centered on top of each other, with correct floor-to-floor height spacing
- Add a **staircase opening** element that can be placed on any floor to indicate vertical circulation between levels
- Update the persistence layer (database schema + API) to store per-floor data

## Capabilities

### New Capabilities
- `floor-management`: Floor CRUD operations, floor switching, per-floor data isolation, and floor ordering within a plan
- `multi-floor-3d-preview`: Stacking all floors vertically in the 3D preview scene with correct height offsets and centering
- `staircase-openings`: Placing staircase opening rectangles on floors to represent vertical circulation spaces

### Modified Capabilities

## Impact

- **Zustand store** (`useFloorplanStore.ts`): Major restructuring — corners, walls, rooms, and floorplan images become floor-scoped; new state for current floor, floor list, floor management actions
- **Database schema** (`schema.ts`): New `floors` table; `corners`, `walls`, and `floorplanImages` gain a `floorId` foreign key
- **API routes** (`api.plans.save.ts`, `api.plans.$id.ts`): Save/load payloads expand to include multi-floor data
- **DB queries** (`queries.ts`): Load/save logic updated for per-floor data reconstruction
- **Room detection** (`roomDetection.ts`): Must filter by floor when detecting room cycles
- **2D scene** (`BuildScene.tsx`): Renders only the active floor's geometry
- **3D scene** (`PreviewScene.tsx`): Renders all floors stacked with Y-offsets
- **UI** (`Toolbar.tsx`, `PropertiesPanel.tsx`): Floor selector, floor settings, stair placement tool
- **Types** (`types.ts`): New `Floor` type, updated `FloorplanState`
- **History** (undo/redo): Must account for floor context in snapshots
