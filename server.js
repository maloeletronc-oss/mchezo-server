const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 10;

const players = {};
let hostId = null;
let raceOn = false;
let finishOrder = [];

// HTTP server — Render inahitaji hii
const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });
    res.end("Mchezo server iko hai!");
});

// WebSocket inaunganishwa kwenye HTTP server hiyo hiyo
const wss = new WebSocketServer({ server });

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Seva ya Mchezo imewaka kwenye port ${PORT}`);
});

function broadcast(data) {
    const message = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on("connection", (ws) => {

    const playerId = Math.random()
        .toString(36)
        .substring(2, 10);

    console.log(`Mchezaji ameunganishwa: ${playerId}`);

    ws.send(JSON.stringify({
        type: "welcome",
        id: playerId
    }));

    ws.on("message", (message) => {

        try {
            const data = JSON.parse(message);

            // PLAYER ANAINGIA
            if (data.type === "join") {

                if (Object.keys(players).length >= MAX_PLAYERS) {
                    ws.send(JSON.stringify({
                        type: "full"
                    }));
                    return;
                }

                players[playerId] = {
                    id: playerId,
                    name: String(data.name || "Racer").slice(0, 12),
                    color: String(data.color || "#ef4444"),

                    x: 0,
                    y: 0,
                    z: 0,
                    rotY: 0,
                    p: 0,
                    v: 0
                };

                if (!hostId) {
                    hostId = playerId;
                }

                console.log(
                    `${players[playerId].name} amejiunga`
                );

                broadcast({
                    type: "state",
                    players: players,
                    host: hostId
                });

                return;
            }

            const me = players[playerId];

            if (!me) return;

            // PLAYER MOVEMENT
            if (data.type === "move") {

                me.x = Number(data.x) || 0;
                me.y = Number(data.y) || 0;
                me.z = Number(data.z) || 0;
                me.rotY = Number(data.rotY) || 0;
                me.p = Number(data.p) || 0;
                me.v = Number(data.v) || 0;

                return;
            }

            // HOST ANZA RACE
            if (data.type === "start") {

                if (playerId !== hostId) {
                    return;
                }

                raceOn = true;
                finishOrder = [];

                Object.values(players).forEach((player) => {
                    player.p = 0;
                    player.v = 0;
                });

                const roster = Object.values(players).map((player) => ({
                    id: player.id,
                    name: player.name,
                    color: player.color
                }));

                broadcast({
                    type: "start",
                    roster: roster
                });

                console.log("Race imeanza!");

                return;
            }

            // PLAYER AMEMALIZA
            if (data.type === "finish") {

                if (!raceOn) return;

                if (finishOrder.includes(playerId)) {
                    return;
                }

                finishOrder.push(playerId);

                broadcast({
                    type: "rank",
                    order: finishOrder
                });

                console.log(
                    `${me.name} amemaliza nafasi ${finishOrder.length}`
                );

                return;
            }

        } catch (error) {
            console.error("Message error:", error);
        }
    });

    ws.on("close", () => {

        const name = players[playerId]?.name || playerId;

        console.log(`${name} ameondoka`);

        delete players[playerId];

        // Kama host ameondoka, mchezaji mwingine anakuwa host
        if (hostId === playerId) {
            hostId = Object.keys(players)[0] || null;
        }

        // Hakuna players
        if (Object.keys(players).length === 0) {
            raceOn = false;
            finishOrder = [];
            hostId = null;
        }

        broadcast({
            type: "state",
            players: players,
            host: hostId
        });
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error.message);
    });
});

// Tuma game state kila 50ms
setInterval(() => {

    if (Object.keys(players).length > 0) {

        broadcast({
            type: "state",
            players: players,
            host: hostId
        });
    }

}, 50);
