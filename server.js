const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 10;
const wss = new WebSocketServer({ port: PORT });

let players = {};
let hostId = null;
let raceOn = false;
let finishOrder = [];

console.log(`Seva ya Mchezo imewaka kwenye port ${PORT}`);

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36).substring(2, 9);
    console.log(`Mchezaji ameunganishwa: ${playerId}`);
    ws.send(JSON.stringify({ type: 'welcome', id: playerId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                if (Object.keys(players).length >= MAX_PLAYERS) {
                    ws.send(JSON.stringify({ type: 'full' }));
                    return;
                }
                players[playerId] = {
                    id: playerId,
                    name: String(data.name || 'Racer').slice(0, 12),
                    color: String(data.color || '#ef4444'),
                    x: 0, y: 0, z: 0, rotY: 0, p: 0, v: 0
                };
                if (!hostId) hostId = playerId;
                return;
            }

            const me = players[playerId];
            if (!me) return;

            if (data.type === 'move') {
                me.x = Number(data.x) || 0;
                me.y = Number(data.y) || 0;
                me.z = Number(data.z) || 0;
                me.rotY = Number(data.rotY) || 0;
                me.p = Number(data.p) || 0;
                me.v = Number(data.v) || 0;
            } else if (data.type === 'start' && playerId === hostId) {
                raceOn = true;
                finishOrder = [];
                const roster = Object.values(players).map((p) => ({ id: p.id, name: p.name, color: p.color }));
                Object.values(players).forEach((p) => { p.p = 0; p.v = 0; });
                broadcast({ type: 'start', roster });
            } else if (data.type === 'finish' && raceOn && !finishOrder.includes(playerId)) {
                finishOrder.push(playerId);
                broadcast({ type: 'rank', order: finishOrder });
            } else if (data.type === 'shoot') {
                broadcast({ type: 'shoot', playerId: playerId });
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        console.log(`Mchezaji ameondoka: ${playerId}`);
        delete players[playerId];
        if (hostId === playerId) hostId = Object.keys(players)[0] || null;
        if (Object.keys(players).length === 0) {
            raceOn = false;
            finishOrder = [];
        }
    });
});

// Tuma hali ya wachezaji wote mara 20 kwa sekunde
setInterval(() => {
    if (Object.keys(players).length > 0) {
        broadcast({ type: 'state', players: players, host: hostId });
    }
}, 50);
