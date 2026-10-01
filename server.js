const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 10;

const players = {};
let hostId = null;
let raceOn = false;
let finishOrder = [];

// HTTP Server yenye CORS na Health Check kwa ajili ya Render Cold Start
const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("SPEED DRIFT 3D SERVER ONLINE");
});

const wss = new WebSocketServer({ server });

server.listen(PORT, "0.0.0.0", () => {
    console.log("SPEED DRIFT Server online on port " + PORT);
});

// Heartbeat Keep-Alive kuzuia Render kukata Connection iliyokaa kimya
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 25000);

function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    });
}

function publicPlayers() {
    const result = {};
    Object.keys(players).forEach(id => {
        const p = players[id];
        result[id] = {
            id: p.id,
            name: p.name,
            color: p.color,
            x: p.x,
            y: p.y,
            z: p.z,
            rotY: p.rotY,
            p: p.p,
            v: p.v
        };
    });
    return result;
}

function broadcastState() {
    broadcast({
        type: "state",
        players: publicPlayers(),
        host: hostId
    });
}

wss.on("connection", ws => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    const playerId = Math.random().toString(36).substring(2, 10);
    console.log("Player connected:", playerId);

    send(ws, { type: "welcome", id: playerId });

    ws.on("message", raw => {
        try {
            const data = JSON.parse(raw);

            // JOIN LOBBY
            if (data.type === "join") {
                if (Object.keys(players).length >= MAX_PLAYERS) {
                    send(ws, { type: "full" });
                    return;
                }

                players[playerId] = {
                    id: playerId,
                    name: String(data.name || "Racer").slice(0, 12),
                    color: String(data.color || "#ef4444"),
                    x: 0, y: 0, z: 0, rotY: 0, p: 0, v: 0,
                    ws: ws
                };

                if (!hostId) {
                    hostId = playerId;
                }

                console.log(players[playerId].name + " yupo ONLINE (ID: " + playerId + ")");
                broadcastState();
                return;
            }

            const me = players[playerId];
            if (!me) return;

            // MOVEMENT DATA
            if (data.type === "move") {
                me.x = Number(data.x) || 0;
                me.y = Number(data.y) || 0;
                me.z = Number(data.z) || 0;
                me.rotY = Number(data.rotY) || 0;
                me.p = Number(data.p) || 0;
                me.v = Number(data.v) || 0;
                return;
            }

            // INVITE PLAYER (PUBG STYLE)
            if (data.type === "invite") {
                const target = players[data.targetId];
                if (!target) {
                    send(ws, { type: "invite_error", message: "Mchezaji huyo hayupo ONLINE" });
                    return;
                }
                send(target.ws, {
                    type: "invite",
                    from: { id: me.id, name: me.name, color: me.color }
                });
                console.log(me.name + " amemwalika " + target.name);
                return;
            }

            // INVITE RESPONSE (KUBALI / KATAA)
            if (data.type === "invite_response") {
                const sender = players[data.fromId];
                if (!sender) return;
                send(sender.ws, {
                    type: "invite_response",
                    accepted: !!data.accepted,
                    from: { id: me.id, name: me.name }
                });
                return;
            }

            // START RACE
            if (data.type === "start") {
                if (playerId !== hostId) return;
                raceOn = true;
                finishOrder = [];
                Object.values(players).forEach(player => {
                    player.p = 0;
                    player.v = 0;
                });
                const roster = Object.values(players).map(player => ({
                    id: player.id,
                    name: player.name,
                    color: player.color
                }));
                broadcast({ type: "start", roster: roster });
                console.log("RACE STARTED BY HOST:", me.name);
                return;
            }

            // FINISH
            if (data.type === "finish") {
                if (!raceOn) return;
                if (finishOrder.includes(playerId)) return;
                finishOrder.push(playerId);
                broadcast({ type: "rank", order: finishOrder });
                console.log(me.name + " finished at position " + finishOrder.length);
                return;
            }

        } catch (error) {
            console.log("Message error:", error.message);
        }
    });

    ws.on("close", () => {
        const name = players[playerId]?.name || playerId;
        console.log(name + " ametoka OFFLINE");
        delete players[playerId];

        if (hostId === playerId) {
            hostId = Object.keys(players)[0] || null;
        }

        if (Object.keys(players).length === 0) {
            raceOn = false;
            finishOrder = [];
            hostId = null;
        }

        broadcastState();
    });

    ws.on("error", error => {
        console.log("WebSocket error:", error.message);
    });
});

setInterval(() => {
    if (Object.keys(players).length > 0) {
        broadcastState();
    }
}, 100);
