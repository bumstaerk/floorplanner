import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// 1. Plans — top-level saved plan
// ---------------------------------------------------------------------------
export const plans = sqliteTable("plans", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    defaultWallThickness: real("default_wall_thickness").notNull().default(0.4),
    defaultWallHeight: real("default_wall_height").notNull().default(2.2),
    createdAt: integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer("updated_at")
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
});

// ---------------------------------------------------------------------------
// 2. Floors — individual floors within a plan
// ---------------------------------------------------------------------------
export const floors = sqliteTable("floors", {
    id: text("id").primaryKey(),
    planId: text("plan_id")
        .notNull()
        .references(() => plans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull().default(0),
    floorHeight: real("floor_height").notNull().default(2.8),
});

// ---------------------------------------------------------------------------
// 3. Corners — corner nodes in the plan
// ---------------------------------------------------------------------------
export const corners = sqliteTable("corners", {
    id: text("id").primaryKey(),
    planId: text("plan_id")
        .notNull()
        .references(() => plans.id, { onDelete: "cascade" }),
    floorId: text("floor_id")
        .notNull()
        .references(() => floors.id, { onDelete: "cascade" }),
    x: real("x").notNull(),
    y: real("y").notNull(),
});

// ---------------------------------------------------------------------------
// 3. Walls — wall segments between corners
// ---------------------------------------------------------------------------
export const walls = sqliteTable("walls", {
    id: text("id").primaryKey(),
    planId: text("plan_id")
        .notNull()
        .references(() => plans.id, { onDelete: "cascade" }),
    floorId: text("floor_id")
        .notNull()
        .references(() => floors.id, { onDelete: "cascade" }),
    startId: text("start_id").notNull(),
    endId: text("end_id").notNull(),
    thickness: real("thickness"),
    height: real("height"),
    visible: integer("visible").notNull().default(1),
});

// ---------------------------------------------------------------------------
// 4. Wall Openings — openings (doors / windows / holes) on walls
// ---------------------------------------------------------------------------
export const wallOpenings = sqliteTable("wall_openings", {
    id: text("id").primaryKey(),
    wallId: text("wall_id")
        .notNull()
        .references(() => walls.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "door" | "window" | "hole"
    offset: real("offset").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    elevation: real("elevation").notNull(),
    face: text("face").notNull(), // "left" | "right"
});

// ---------------------------------------------------------------------------
// 5. Wall Components — components attached to walls
// ---------------------------------------------------------------------------
export const wallComponents = sqliteTable("wall_components", {
    id: text("id").primaryKey(),
    wallId: text("wall_id")
        .notNull()
        .references(() => walls.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    offset: real("offset").notNull(),
    elevation: real("elevation").notNull(),
    face: text("face").notNull(), // "left" | "right"
    meta: text("meta"), // nullable JSON string
});

// ---------------------------------------------------------------------------
// 6. Floorplan Images — uploaded floorplan image metadata per plan
// ---------------------------------------------------------------------------
export const floorplanImages = sqliteTable("floorplan_images", {
    id: text("id").primaryKey(),
    planId: text("plan_id")
        .notNull()
        .references(() => plans.id, { onDelete: "cascade" }),
    floorId: text("floor_id")
        .notNull()
        .references(() => floors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    imageData: text("image_data").notNull(), // base64 data URL
    widthMeters: real("width_meters").notNull(),
    heightMeters: real("height_meters").notNull(),
    scale: real("scale").notNull().default(1),
    opacity: real("opacity").notNull().default(0.5),
});

// ---------------------------------------------------------------------------
// 7. Staircase Openings — rectangular staircase areas on floors
// ---------------------------------------------------------------------------
export const staircaseOpenings = sqliteTable("staircase_openings", {
    id: text("id").primaryKey(),
    floorId: text("floor_id")
        .notNull()
        .references(() => floors.id, { onDelete: "cascade" }),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull().default(1.0),
    depth: real("depth").notNull().default(2.5),
    rotation: real("rotation").notNull().default(0),
});
