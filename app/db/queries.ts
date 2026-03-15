import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CornerNode, WallSegment, FloorplanImage, Floor, StaircaseOpening, RoomComponent } from "~/store/types";

/**
 * A persisted room component with the polygon hash key for re-attachment.
 */
export interface PersistedRoomComponent {
    /** Sorted corner IDs of the room polygon */
    roomKey: string;
    floorId: string;
    component: RoomComponent;
}

export interface LoadedPlan {
    id: string;
    name: string;
    defaultWallThickness: number;
    defaultWallHeight: number;
    createdAt: number;
    updatedAt: number;
    floors: Floor[];
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
    floorplan: FloorplanImage | null;
    staircaseOpenings: Record<string, StaircaseOpening>;
    roomComponents: PersistedRoomComponent[];
}

/**
 * Load a full plan by ID from the database, including all floors, corners, walls
 * (with openings and components), floorplan images, and staircase openings.
 *
 * Returns `null` if the plan does not exist.
 */
export function loadPlanById(planId: string): LoadedPlan | null {
    const plan = db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, planId))
        .get();

    if (!plan) return null;

    // Load floors
    const floorRows = db
        .select()
        .from(schema.floors)
        .where(eq(schema.floors.planId, planId))
        .all();

    const floors: Floor[] = floorRows.map((row) => ({
        id: row.id,
        name: row.name,
        level: row.level,
        floorHeight: row.floorHeight,
    }));

    // If no floors exist (legacy plan), create a virtual default
    let defaultFloorId: string | null = null;
    if (floors.length === 0) {
        defaultFloorId = "default-floor";
        floors.push({
            id: defaultFloorId,
            name: "Ground Floor",
            level: 0,
            floorHeight: 2.8,
        });
    }

    // Load corners
    const cornerRows = db
        .select()
        .from(schema.corners)
        .where(eq(schema.corners.planId, planId))
        .all();

    const corners: Record<string, CornerNode> = {};
    for (const row of cornerRows) {
        corners[row.id] = {
            id: row.id,
            position: { x: row.x, y: row.y },
            floorId: row.floorId || defaultFloorId || floors[0].id,
        };
    }

    // Load walls
    const wallRows = db
        .select()
        .from(schema.walls)
        .where(eq(schema.walls.planId, planId))
        .all();

    const walls: Record<string, WallSegment> = {};
    for (const row of wallRows) {
        // Load openings for this wall
        const openingRows = db
            .select()
            .from(schema.wallOpenings)
            .where(eq(schema.wallOpenings.wallId, row.id))
            .all();
        const openings = openingRows.map((o) => ({
            id: o.id,
            type: o.type as "door" | "window" | "hole",
            offset: o.offset,
            width: o.width,
            height: o.height,
            elevation: o.elevation,
            face: o.face as "left" | "right",
        }));

        // Load components for this wall
        const componentRows = db
            .select()
            .from(schema.wallComponents)
            .where(eq(schema.wallComponents.wallId, row.id))
            .all();
        const components = componentRows.map((c) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            offset: c.offset,
            elevation: c.elevation,
            face: c.face as "left" | "right",
            meta: c.meta ? JSON.parse(c.meta) : undefined,
        }));

        walls[row.id] = {
            id: row.id,
            floorId: row.floorId || defaultFloorId || floors[0].id,
            startId: row.startId,
            endId: row.endId,
            thickness: row.thickness,
            height: row.height,
            visible: row.visible !== 0,
            openings,
            components,
        };
    }

    // Load floorplan image (first one found — currently single image per plan)
    const floorplanRow = db
        .select()
        .from(schema.floorplanImages)
        .where(eq(schema.floorplanImages.planId, planId))
        .get();

    const floorplan: FloorplanImage | null = floorplanRow
        ? {
              floorId: floorplanRow.floorId || defaultFloorId || floors[0].id,
              url: floorplanRow.imageData,
              name: floorplanRow.name,
              widthMeters: floorplanRow.widthMeters,
              heightMeters: floorplanRow.heightMeters,
              scale: floorplanRow.scale,
              opacity: floorplanRow.opacity,
          }
        : null;

    // Load staircase openings
    const staircaseOpenings: Record<string, StaircaseOpening> = {};
    for (const floor of floors) {
        if (floor.id === defaultFloorId) continue; // virtual floor has no DB rows
        const staircaseRows = db
            .select()
            .from(schema.staircaseOpenings)
            .where(eq(schema.staircaseOpenings.floorId, floor.id))
            .all();
        for (const row of staircaseRows) {
            staircaseOpenings[row.id] = {
                id: row.id,
                floorId: row.floorId,
                position: { x: row.x, y: row.y },
                width: row.width,
                depth: row.depth,
                rotation: row.rotation,
            };
        }
    }

    // Load room components
    const roomComponentRows = db
        .select()
        .from(schema.roomComponents)
        .where(eq(schema.roomComponents.planId, planId))
        .all();
    const roomComponents: PersistedRoomComponent[] = roomComponentRows.map((row) => ({
        roomKey: row.roomKey,
        floorId: row.floorId,
        component: {
            id: row.id,
            type: row.type as "light" | "sensor",
            label: row.label,
            x: row.x,
            y: row.y,
            meta: row.meta ? JSON.parse(row.meta) : undefined,
        },
    }));

    return {
        id: plan.id,
        name: plan.name,
        defaultWallThickness: plan.defaultWallThickness,
        defaultWallHeight: plan.defaultWallHeight,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        floors,
        corners,
        walls,
        floorplan,
        staircaseOpenings,
        roomComponents,
    };
}

/**
 * Load the most recently updated plan from the database.
 *
 * Returns `null` if no plans exist.
 */
export function loadMostRecentPlan(): LoadedPlan | null {
    const row = db
        .select({ id: schema.plans.id })
        .from(schema.plans)
        .orderBy(desc(schema.plans.updatedAt))
        .limit(1)
        .get();

    if (!row) return null;

    return loadPlanById(row.id);
}
