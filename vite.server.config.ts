/**
 * Vite config for building the custom Node.js server entry (app/server.ts).
 * Runs after `react-router build` to produce build/server/server.js.
 */
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    build: {
        ssr: "app/server.ts",
        outDir: "build/server",
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: "server.js",
                format: "esm",
            },
        },
    },
});
