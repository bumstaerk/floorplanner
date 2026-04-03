import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const { name, floors, corners, walls, floorplans, staircaseOpenings, roomComponents, roomNames, defaultWallThickness, defaultWallHeight, modelTheme, replaceId, importName } = body;

        // Basic validation
        if (!name || !floors || !corners || !walls) {
            return Response.json(
                { error: "Invalid .fpjson file: missing required fields (name, floors, corners, walls)" },
                { status: 400 },
            );
        }

        const now = Date.now();
        // If replaceId is provided, delete the existing plan first and reuse its ID.
        // Otherwise always generate a fresh UUID so re-importing never collides.
        const planId = replaceId ?? uuid();
        if (replaceId) {
            db.delete(schema.plans).where(eq(schema.plans.id, replaceId)).run();
        }
        const planName = importName ?? name ?? "Untitled Plan";

        // Build ID remapping tables so re-importing the same file never collides
        const floorIdMap = new Map<string, string>();
        const cornerIdMap = new Map<string, string>();

        // ── Plan ──────────────────────────────────────────────────────────────
        db.insert(schema.plans)
            .values({
                id: planId,
                name: planName,
                defaultWallThickness: defaultWallThickness ?? 0.4,
                defaultWallHeight: defaultWallHeight ?? 2.2,
                modelTheme: modelTheme ? JSON.stringify(modelTheme) : null,
                createdAt: now,
                updatedAt: now,
            })
            .run();

        // ── Floors ────────────────────────────────────────────────────────────
        const floorEntries = (floors || []) as Array<{ id: string; name: string; level: number; floorHeight: number }>;

        if (floorEntries.length === 0) {
            const defaultFloorId = uuid();
            floorIdMap.set("default-floor", defaultFloorId);
            db.insert(schema.floors)
                .values({ id: defaultFloorId, planId, name: "Ground Floor", level: 0, floorHeight: 2.8 })
                .run();
        } else {
            for (const floor of floorEntries) {
                const newId = uuid();
                floorIdMap.set(floor.id, newId);
                db.insert(schema.floors)
                    .values({ id: newId, planId, name: floor.name, level: floor.level, floorHeight: floor.floorHeight })
                    .run();
            }
        }

        const fallbackFloorId = floorIdMap.values().next().value as string;

        // ── Corners ───────────────────────────────────────────────────────────
        const cornerEntries = Object.values(corners || {}) as Array<{ id: string; floorId: string; position: { x: number; y: number } }>;
        for (const corner of cornerEntries) {
            const newId = uuid();
            cornerIdMap.set(corner.id, newId);
            db.insert(schema.corners)
                .values({
                    id: newId,
                    planId,
                    floorId: floorIdMap.get(corner.floorId) ?? fallbackFloorId,
                    x: corner.position.x,
                    y: corner.position.y,
                })
                .run();
        }

        // ── Walls ─────────────────────────────────────────────────────────────
        const wallEntries = Object.values(walls || {}) as Array<{
            id: string;
            floorId: string;
            startId: string;
            endId: string;
            thickness: number | null;
            height: number | null;
            visible: boolean;
            openings: Array<{ id: string; type: string; offset: number; width: number; height: number; elevation: number; face: string; hinge?: string }>;
            components: Array<{ id: string; type: string; label: string; offset: number; elevation: number; face: string; meta?: Record<string, unknown>; haEntityId?: string | null }>;
        }>;

        for (const wall of wallEntries) {
            const newWallId = uuid();
            db.insert(schema.walls)
                .values({
                    id: newWallId,
                    planId,
                    floorId: floorIdMap.get(wall.floorId) ?? fallbackFloorId,
                    startId: cornerIdMap.get(wall.startId) ?? wall.startId,
                    endId: cornerIdMap.get(wall.endId) ?? wall.endId,
                    thickness: wall.thickness ?? null,
                    height: wall.height ?? null,
                    visible: wall.visible === false ? 0 : 1,
                })
                .run();

            for (const opening of wall.openings || []) {
                db.insert(schema.wallOpenings)
                    .values({
                        id: uuid(),
                        wallId: newWallId,
                        type: opening.type,
                        offset: opening.offset,
                        width: opening.width,
                        height: opening.height,
                        elevation: opening.elevation,
                        face: opening.face,
                        hinge: opening.hinge ?? "start",
                    })
                    .run();
            }

            for (const component of wall.components || []) {
                db.insert(schema.wallComponents)
                    .values({
                        id: uuid(),
                        wallId: newWallId,
                        type: component.type,
                        label: component.label,
                        offset: component.offset,
                        elevation: component.elevation,
                        face: component.face,
                        meta: component.meta ? JSON.stringify(component.meta) : null,
                        haEntityId: component.haEntityId ?? null,
                    })
                    .run();
            }
        }

        // ── Floorplan images ──────────────────────────────────────────────────
        for (const fp of floorplans || []) {
            db.insert(schema.floorplanImages)
                .values({
                    id: uuid(),
                    planId,
                    floorId: floorIdMap.get(fp.floorId) ?? fallbackFloorId,
                    name: fp.name,
                    imageData: fp.url,
                    widthMeters: fp.widthMeters,
                    heightMeters: fp.heightMeters,
                    scale: fp.scale ?? 1,
                    opacity: fp.opacity ?? 0.5,
                })
                .run();
        }

        // ── Staircase openings ────────────────────────────────────────────────
        const staircaseEntries = Object.values(staircaseOpenings || {}) as Array<{
            id: string;
            floorId: string;
            position: { x: number; y: number };
            width: number;
            depth: number;
            rotation: number;
        }>;
        for (const staircase of staircaseEntries) {
            db.insert(schema.staircaseOpenings)
                .values({
                    id: uuid(),
                    floorId: floorIdMap.get(staircase.floorId) ?? fallbackFloorId,
                    x: staircase.position.x,
                    y: staircase.position.y,
                    width: staircase.width,
                    depth: staircase.depth,
                    rotation: staircase.rotation,
                })
                .run();
        }

        // ── Room components ───────────────────────────────────────────────────
        // LoadedPlan format: { roomKey, floorId, component: { id, type, label, x, y, meta, haEntityId } }
        const rcEntries = (roomComponents || []) as Array<{
            roomKey: string;
            floorId: string;
            component: { id: string; type: string; label: string; x: number; y: number; meta?: Record<string, unknown>; haEntityId?: string | null };
        }>;
        for (const rc of rcEntries) {
            const remappedKey = rc.roomKey.split(",").map((cid: string) => cornerIdMap.get(cid) ?? cid).sort().join(",");
            db.insert(schema.roomComponents)
                .values({
                    id: uuid(),
                    planId,
                    floorId: floorIdMap.get(rc.floorId) ?? fallbackFloorId,
                    roomKey: remappedKey,
                    type: rc.component.type,
                    label: rc.component.label,
                    x: rc.component.x,
                    y: rc.component.y,
                    meta: rc.component.meta ? JSON.stringify(rc.component.meta) : null,
                    haEntityId: rc.component.haEntityId ?? null,
                })
                .run();
        }

        // ── Room names ────────────────────────────────────────────────────────
        const rnEntries = (roomNames || []) as Array<{ roomKey: string; floorId: string; name: string }>;
        for (const rn of rnEntries) {
            const remappedKey = rn.roomKey.split(",").map((cid: string) => cornerIdMap.get(cid) ?? cid).sort().join(",");
            db.insert(schema.roomNames)
                .values({
                    id: uuid(),
                    planId,
                    floorId: floorIdMap.get(rn.floorId) ?? fallbackFloorId,
                    roomKey: remappedKey,
                    name: rn.name,
                })
                .run();
        }

        return Response.json({ id: planId, name: planName });
    } catch (error) {
        console.error("Failed to import plan:", error);
        return Response.json({ error: "Failed to import plan" }, { status: 500 });
    }
}
