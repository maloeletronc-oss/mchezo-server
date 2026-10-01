const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`Seva ya WebSocket imewaka kwenye port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Mchezaji ameunganishwa!');

    ws.on('message', (message) => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Mchezaji ametoka.');
    });
});
