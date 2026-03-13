import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CornerNode, WallSegment, FloorplanImage } from "~/store/types";

export interface LoadedPlan {
    id: string;
    name: string;
    defaultWallThickness: number;
    defaultWallHeight: number;
    createdAt: number;
    updatedAt: number;
    corners: Record<string, CornerNode>;
    walls: Record<string, WallSegment>;
    floorplan: FloorplanImage | null;
}

/**
 * Load a full plan by ID from the database, including all corners, walls
 * (with openings and components), and the floorplan image.
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

    // Load corners
    const cornerRows = db
        .select()
        .from(schema.corners)
        .where(eq(schema.corners.planId, planId))
        .all();

    const corners: Record<string, CornerNode> = {};
    for (const row of cornerRows) {
        corners[row.id] = { id: row.id, position: { x: row.x, y: row.y } };
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
            startId: row.startId,
            endId: row.endId,
            thickness: row.thickness,
            height: row.height,
            visible: row.visible !== 0,
            openings,
            components,
        };
    }

    // Load floorplan image
    const floorplanRow = db
        .select()
        .from(schema.floorplanImages)
        .where(eq(schema.floorplanImages.planId, planId))
        .get();

    const floorplan = floorplanRow
        ? {
              url: floorplanRow.imageData,
              name: floorplanRow.name,
              widthMeters: floorplanRow.widthMeters,
              heightMeters: floorplanRow.heightMeters,
              scale: floorplanRow.scale,
              opacity: floorplanRow.opacity,
          }
        : null;

    return {
        id: plan.id,
        name: plan.name,
        defaultWallThickness: plan.defaultWallThickness,
        defaultWallHeight: plan.defaultWallHeight,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        corners,
        walls,
        floorplan,
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
