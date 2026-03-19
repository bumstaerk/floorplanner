import { getHAConfig, setHAConfig, deleteHAConfig } from "~/db/queries";
import { haBridge } from "~/services/haWebSocketBridge";
import type { Route } from "./+types/api.ha.config";

export async function loader(_: Route.LoaderArgs) {
    const config = getHAConfig();
    return Response.json({ configured: config !== null });
}

export async function action({ request }: Route.ActionArgs) {
    if (request.method === "POST") {
        const body = await request.json();
        const { host, token } = body as { host: string; token: string };
        if (!host || !token) {
            return Response.json({ error: "host and token are required" }, { status: 400 });
        }
        setHAConfig(host.trim(), token.trim());
        haBridge.connect(host.trim(), token.trim());
        return Response.json({ ok: true });
    }

    if (request.method === "DELETE") {
        haBridge.disconnect();
        deleteHAConfig();
        return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
}
