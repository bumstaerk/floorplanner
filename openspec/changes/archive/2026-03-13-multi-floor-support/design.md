## Context

The floorplanner currently models a single flat layer of walls, corners, rooms, and one optional background image per plan. All state lives in a flat Zustand store (`FloorplanState`) with `corners`, `walls`, `rooms`, and `floorplan` at the top level. The database mirrors this: `corners` and `walls` reference a `planId` directly, and `floorplanImages` has a unique constraint on `planId` (one image per plan).

To support multi-story buildings, the data model must gain a "floor" dimension that scopes geometry per floor while keeping the API surface and rendering pipeline minimally disrupted.

## Goals / Non-Goals

**Goals:**
- Support N floors per plan, each with independent corners, walls, rooms, and a background floorplan image
- In 2D build mode, edit one floor at a time with a floor switcher UI
- In 3D preview mode, render all floors stacked vertically with correct floor-to-floor spacing, centered
- Allow placing staircase opening rectangles on floors to mark vertical circulation
- Persist multi-floor plans to the database and load/save them correctly
- Migrate existing single-floor plans to the new schema seamlessly (treated as floor 0 / "Ground Floor")

**Non-Goals:**
- Stairs as full 3D geometry (step-by-step modeling) — only a rectangular opening/placeholder
- Cross-floor wall continuity or alignment enforcement
- Per-floor snap/grid settings (global settings apply to all floors)
- Floor-specific undo/redo history (history remains global across all floors)
- Copy/paste geometry between floors

## Decisions

### 1. Floor-scoped data via `floorId` on entities (Option B)

**Decision**: Add a `floorId` field to `CornerNode`, `WallSegment`, and `FloorplanImage` rather than nesting them under a `floors` map in the store.

**Rationale**: This minimizes refactoring of the store shape. The existing flat `corners`, `walls`, `rooms` records remain, and all existing actions (addCorner, addWall, etc.) continue to work — they just need to tag new entities with the current floor ID. Scene components filter by `currentFloorId` when rendering. This avoids rewriting every store action signature.

**Alternatives considered**:
- *Floor-scoped maps* (`floors: Record<floorId, {corners, walls, rooms}>`): Cleaner separation but requires rewriting every action, every selector, and every component that reads corners/walls. Too much churn for the benefit.

### 2. New `floors` table and store field

**Decision**: Add a `floors` DB table (`id`, `planId`, `name`, `level`, `floorHeight`) and a `floors: Floor[]` array + `currentFloorId: string` in the Zustand store.

- `level` is an integer (0 = ground, 1 = first floor, -1 = basement) used for sort order and 3D Y-offset calculation.
- `floorHeight` is the floor-to-floor height in meters (default 2.8m) used to compute Y-offsets in 3D.
- Every plan has at least one floor. On `newPlan()`, a default "Ground Floor" (level 0) is created automatically.

### 3. Room detection filtered by floor

**Decision**: `detectRooms()` runs once per floor, filtering corners/walls by `floorId`. Results are stored with a `floorId` on each `Room`. The existing Zustand subscription triggers detection for the floor that changed.

### 4. 3D stacking in PreviewScene

**Decision**: In `PreviewScene`, iterate all floors sorted by `level`. For each floor, compute a Y-offset = sum of `floorHeight` values for all floors below it. Render that floor's walls with the Y-offset applied. A thin slab (floor plate) renders between floors. All floors are centered on the XZ origin by computing the combined bounding box centroid.

### 5. Staircase openings as a room-level annotation

**Decision**: Model staircase openings as a new entity `StaircaseOpening` with `{id, floorId, position: Point2D, width, depth, rotation}`. This is a rectangular area placed on a floor. In 2D it renders as a labeled rectangle with a stair icon. In 3D it renders as a rectangular hole/cutout in the floor plate and a simple stair placeholder mesh.

**Alternatives considered**:
- *Staircase as a wall opening type*: Stairs aren't really wall openings — they're floor areas. Separate entity is cleaner.
- *Staircase as a room type*: Rooms are auto-detected from wall cycles. Stairs may not have enclosing walls. Separate entity gives more control.

### 6. History stays global

**Decision**: History snapshots continue to capture all corners and walls (across all floors) plus the new staircase openings. This keeps undo/redo simple — no per-floor history tracking needed. The `HistoryEntry` type expands to include `staircaseOpenings`.

### 7. Database migration for existing plans

**Decision**: Use Drizzle's migration system. The migration:
1. Creates the `floors` table
2. Creates the `staircase_openings` table
3. Adds `floor_id` columns to `corners`, `walls`, `floorplan_images`
4. For each existing plan, inserts a default floor ("Ground Floor", level 0) and sets all existing corners/walls/images to reference it
5. Removes the unique constraint on `floorplan_images.plan_id` (now one image per floor, not per plan)

## Risks / Trade-offs

- **Bundle size**: Adding floor management UI and staircase components increases the client bundle. Mitigation: these are lightweight — no new heavy dependencies.
- **Performance with many floors**: Rendering all floors in 3D preview simultaneously could slow down for complex plans. Mitigation: residential buildings rarely exceed 3-4 floors; acceptable for initial release.
- **Migration complexity**: Existing single-floor plans must be migrated. Mitigation: SQLite migration adds a default floor and backfills `floorId` — straightforward and reversible.
- **History bloat**: Global history snapshots now include all floors, increasing memory per snapshot. Mitigation: 100-entry cap already exists; multi-floor plans are unlikely to have 10x the geometry.
