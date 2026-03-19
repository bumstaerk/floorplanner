import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CornerNode, WallSegment, FloorplanImage, Floor, StaircaseOpening, RoomComponent, ModelTheme } from "~/store/types";

/**
 * A persisted room component with the polygon hash key for re-attachment.
 */
export interface PersistedRoomComponent {
    /** Sorted corner IDs of the room polygon */
    roomKey: string;
    floorId: string;
    component: RoomComponent;
}

/**
 * A persisted room name with the polygon hash key for re-attachment.
 */
export interface PersistedRoomName {
    /** Sorted corner IDs of the room polygon */
    roomKey: string;
    floorId: string;
    name: string;
}

export interface LoadedPlan {
    id: string;
    name: string;
    defaultWallThickness: number;
    defaultWallHeight: number;
    modelTheme: ModelTheme | null;
    createdAt: number;
    updatedAt: number;
    floors: Floor[];
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
    floorplans: FloorplanImage[];
    staircaseOpenings: Record<string, StaircaseOpening>;
    roomComponents: PersistedRoomComponent[];
    roomNames: PersistedRoomName[];
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
            hinge: (o.hinge as "start" | "end" | null) ?? "start",
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
            haEntityId: c.haEntityId ?? null,
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

    // Load all floorplan images for this plan (one per floor)
    const floorplanRows = db
        .select()
        .from(schema.floorplanImages)
        .where(eq(schema.floorplanImages.planId, planId))
        .all();

    const floorplans: FloorplanImage[] = floorplanRows.map((row) => ({
        floorId: row.floorId || defaultFloorId || floors[0].id,
        url: row.imageData,
        name: row.name,
        widthMeters: row.widthMeters,
        heightMeters: row.heightMeters,
        scale: row.scale,
        opacity: row.opacity,
    }));

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
            haEntityId: row.haEntityId ?? null,
        },
    }));

    // Load room names
    const roomNameRows = db
        .select()
        .from(schema.roomNames)
        .where(eq(schema.roomNames.planId, planId))
        .all();
    const roomNames: PersistedRoomName[] = roomNameRows.map((row) => ({
        roomKey: row.roomKey,
        floorId: row.floorId,
        name: row.name,
    }));

    return {
        id: plan.id,
        name: plan.name,
        defaultWallThickness: plan.defaultWallThickness,
        defaultWallHeight: plan.defaultWallHeight,
        modelTheme: plan.modelTheme ? JSON.parse(plan.modelTheme) as ModelTheme : null,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        floors,
        corners,
        walls,
        floorplans,
        staircaseOpenings,
        roomComponents,
        roomNames,
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

// ─── HA Config queries ────────────────────────────────────────────────────────

/** Returns the stored HA host and token, or null if not configured. */
export function getHAConfig(): { host: string; token: string } | null {
    const row = db.select().from(schema.haConfig).where(eq(schema.haConfig.id, 1)).get();
    if (!row) return null;
    return { host: row.host, token: row.token };
}

/** Upserts the single ha_config row (id = 1). */
export function setHAConfig(host: string, token: string): void {
    db.insert(schema.haConfig)
        .values({ id: 1, host, token, updatedAt: Date.now() })
        .onConflictDoUpdate({
            target: schema.haConfig.id,
            set: { host, token, updatedAt: Date.now() },
        })
        .run();
}

/** Removes the ha_config row. */
export function deleteHAConfig(): void {
    db.delete(schema.haConfig).where(eq(schema.haConfig.id, 1)).run();
}
