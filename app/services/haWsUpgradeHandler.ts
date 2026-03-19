import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { haBridge } from "./haWebSocketBridge.js";

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
    haBridge.registerClient(ws);
    ws.on("close", () => haBridge.deregisterClient(ws));
});

export function haWsUpgradeHandler(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
): void {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
}
