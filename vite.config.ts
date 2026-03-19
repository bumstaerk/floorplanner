import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

/**
 * Vite dev plugin: intercepts /api/ha/ws upgrade requests on Vite's HTTP server
 * before the HMR WebSocket handler claims them.
 */
function haWsDevPlugin(): Plugin {
    return {
        name: "ha-ws-dev",
        configureServer(server) {
            server.httpServer?.on("upgrade", (req, socket, head) => {
                if (req.url === "/api/ha/ws") {
                    // Dynamically import to avoid SSR issues with ws during dev
                    import("./app/services/haWsUpgradeHandler.js").then(({ haWsUpgradeHandler }) => {
                        haWsUpgradeHandler(req, socket, head);
                    }).catch(() => socket.destroy());
                }
            });
        },
    };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), haWsDevPlugin()],
});
