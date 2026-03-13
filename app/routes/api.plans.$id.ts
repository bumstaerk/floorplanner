import { loadPlanById } from "~/db/queries";
import { db } from "~/db";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.plans.$id";

export async function loader({ params }: Route.LoaderArgs) {
    const planId = params.id;

    const plan = loadPlanById(planId);
    if (!plan) {
        return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    return Response.json(plan);
}

export async function action({ request, params }: Route.ActionArgs) {
    if (request.method !== "DELETE") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const planId = params.id;
    // Cascade delete handles all related data
    db.delete(schema.plans).where(eq(schema.plans.id, planId)).run();

    return Response.json({ ok: true });
}
