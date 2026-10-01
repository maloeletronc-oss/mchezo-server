const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

let players = {};

console.log(`Seva ya Mchezo imewaka kwenye port ${PORT}`);

wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36.substring(2, 9));
    console.log(`Mchezaji ameunganishwa: ${playerId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join') {
                players[playerId] = { id: playerId, x: 0, y: 1, z: 0, rotY: 0 };
            } else if (data.type === 'move') {
                if (players[playerId]) {
                    players[playerId].x = data.x;
                    players[playerId].y = data.y;
                    players[playerId].z = data.z;
                    players[playerId].rotY = data.rotY;
                }
            } else if (data.type === 'shoot') {
                // Sambaza taarifa za risasi kwa wachezaji wote
                broadcast({ type: 'shoot', playerId: playerId });
                return;
            }

            // Tuma orodha ya wachezaji wote kwa kila mtu
            broadcast({ type: 'state', players: players });
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        console.log(`Mchezaji ametoka: ${playerId}`);
        delete players[playerId];
        broadcast({ type: 'state', players: players });
    });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(msg);
        }
    });
}
