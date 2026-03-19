import { getHAConfig } from "~/db/queries";
import type { HAEntity } from "~/store/types";
import type { Route } from "./+types/api.ha.entities";

export async function loader(_: Route.LoaderArgs) {
    const config = getHAConfig();
    if (!config) {
        return Response.json([] as HAEntity[]);
    }

    try {
        const response = await fetch(`${config.host}/api/states`, {
            headers: {
                Authorization: `Bearer ${config.token}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return Response.json(
                { error: `Home Assistant returned ${response.status}` },
                { status: 502 },
            );
        }

        const states = (await response.json()) as Array<{
            entity_id: string;
            state: string;
            attributes: { friendly_name?: string };
        }>;

        const entities: HAEntity[] = states.map((s) => ({
            entityId: s.entity_id,
            friendlyName: s.attributes.friendly_name ?? s.entity_id,
            domain: s.entity_id.split(".")[0],
            state: s.state,
        }));

        return Response.json(entities);
    } catch {
        return Response.json(
            { error: "Could not reach Home Assistant" },
            { status: 502 },
        );
    }
}
