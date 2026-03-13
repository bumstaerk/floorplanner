import { db } from "~/db";
import * as schema from "~/db/schema";
import { desc } from "drizzle-orm";
import type { Route } from "./+types/api.plans";

export async function loader({ request }: Route.LoaderArgs) {
    const plans = db
        .select({
            id: schema.plans.id,
            name: schema.plans.name,
            createdAt: schema.plans.createdAt,
            updatedAt: schema.plans.updatedAt,
        })
        .from(schema.plans)
        .orderBy(desc(schema.plans.updatedAt))
        .all();

    return Response.json(plans);
}
