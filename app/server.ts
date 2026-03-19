/**
 * Custom Node.js HTTP server entry for production.
 *
 * Wraps the React Router request handler and adds a WebSocket upgrade handler
 * for the /api/ha/ws path, which fans out Home Assistant state updates to
 * connected browser clients.
 *
 * Build: vite build --config vite.server.config.ts
 * Run:   node ./build/server/server.js
 */

import { createRequestListener } from "@react-router/node";
import * as http from "node:http";
import { haWsUpgradeHandler } from "./services/haWsUpgradeHandler.js";
import { haBridge } from "./services/haWebSocketBridge.js";
import { getHAConfig } from "./db/queries.js";

// The react-router server build is in the same output directory as this file.
// import.meta.url at runtime = file:///…/build/server/server.js
// so ./index.js resolves to file:///…/build/server/index.js
const build = await import(/* @vite-ignore */ new URL("./index.js", import.meta.url).href);

const requestListener = createRequestListener({ build: build as never });

const server = http.createServer(requestListener);

server.on("upgrade", (req, socket, head) => {
    if (req.url === "/api/ha/ws") {
        haWsUpgradeHandler(req, socket, head);
    } else {
        socket.destroy();
    }
});

// Auto-connect to HA on server startup if config exists
const haConfig = getHAConfig();
if (haConfig) {
    haBridge.connect(haConfig.host, haConfig.token);
}

const port = parseInt(process.env.PORT ?? "3000", 10);
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
