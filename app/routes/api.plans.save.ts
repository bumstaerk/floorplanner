import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Route } from "./+types/api.plans.save";

export async function action({ request }: Route.ActionArgs) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const {
            name,
            corners,
            walls,
            floorplan,
            defaultWallThickness,
            defaultWallHeight,
        } = body;
        const planId = body.id || uuid();
        const now = Date.now();

        // Upsert: delete old data if updating an existing plan
        const existing = db
            .select()
            .from(schema.plans)
            .where(eq(schema.plans.id, planId))
            .get();
        if (existing) {
            // Cascade delete handles corners, walls, openings, components, floorplan_images
            db.delete(schema.plans).where(eq(schema.plans.id, planId)).run();
        }

        // Insert plan
        db.insert(schema.plans)
            .values({
                id: planId,
                name: name || "Untitled Plan",
                defaultWallThickness: defaultWallThickness ?? 0.4,
                defaultWallHeight: defaultWallHeight ?? 2.2,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
            })
            .run();

        // Insert corners
        const cornerEntries = Object.values(corners || {}) as Array<{
            id: string;
            position: { x: number; y: number };
        }>;
        for (const corner of cornerEntries) {
            db.insert(schema.corners)
                .values({
                    id: corner.id,
                    planId,
                    x: corner.position.x,
                    y: corner.position.y,
                })
                .run();
        }

        // Insert walls (without openings/components first)
        const wallEntries = Object.values(walls || {}) as Array<{
            id: string;
            startId: string;
            endId: string;
            thickness: number | null;
            height: number | null;
            visible: boolean;
            openings: Array<{
                id: string;
                type: string;
                offset: number;
                width: number;
                height: number;
                elevation: number;
                face: string;
            }>;
            components: Array<{
                id: string;
                type: string;
                label: string;
                offset: number;
                elevation: number;
                face: string;
                meta?: Record<string, unknown>;
            }>;
        }>;

        for (const wall of wallEntries) {
            db.insert(schema.walls)
                .values({
                    id: wall.id,
                    planId,
                    startId: wall.startId,
                    endId: wall.endId,
                    thickness: wall.thickness ?? null,
                    height: wall.height ?? null,
                    visible: wall.visible === false ? 0 : 1,
                })
                .run();

            // Insert openings
            for (const opening of wall.openings || []) {
                db.insert(schema.wallOpenings)
                    .values({
                        id: opening.id,
                        wallId: wall.id,
                        type: opening.type,
                        offset: opening.offset,
                        width: opening.width,
                        height: opening.height,
                        elevation: opening.elevation,
                        face: opening.face,
                    })
                    .run();
            }

            // Insert components
            for (const component of wall.components || []) {
                db.insert(schema.wallComponents)
                    .values({
                        id: component.id,
                        wallId: wall.id,
                        type: component.type,
                        label: component.label,
                        offset: component.offset,
                        elevation: component.elevation,
                        face: component.face,
                        meta: component.meta
                            ? JSON.stringify(component.meta)
                            : null,
                    })
                    .run();
            }
        }

        // Insert floorplan image if present
        if (floorplan) {
            db.insert(schema.floorplanImages)
                .values({
                    id: uuid(),
                    planId,
                    name: floorplan.name,
                    imageData: floorplan.url, // expects a data URL (base64)
                    widthMeters: floorplan.widthMeters,
                    heightMeters: floorplan.heightMeters,
                    scale: floorplan.scale ?? 1,
                    opacity: floorplan.opacity ?? 0.5,
                })
                .run();
        }

        return Response.json({ id: planId, name: name || "Untitled Plan" });
    } catch (error) {
        console.error("Failed to save plan:", error);
        return Response.json({ error: "Failed to save plan" }, { status: 500 });
    }
}
