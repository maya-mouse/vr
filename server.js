const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json({ limit: '15mb' }));

let latestRotationVector = [0, 0, 0, 1]; 

app.post('/sensor', (req, res) => {
    if (req.body && req.body.payload && Array.isArray(req.body.payload)) {
        
        const rotationSensor = req.body.payload.find(s => s.name === 'orientation');
        
        if (rotationSensor && rotationSensor.values) {
            const v = rotationSensor.values;
            
            if (v.qx !== undefined && v.qy !== undefined && v.qz !== undefined && v.qw !== undefined) {
                latestRotationVector = [v.qx, v.qy, v.qz, v.qw];
                
                console.log(`[iOS Стрім] Кватерніон оновлено: X=${v.qx.toFixed(3)}, Y=${v.qy.toFixed(3)}, Z=${v.qz.toFixed(3)}, W=${v.qw.toFixed(3)}`);
            }
        }
    }

    res.sendStatus(200);
});

setInterval(() => {
    if (wss.clients.size > 0) {
        const message = JSON.stringify({
            type: "rotation_vector",
            sensorType: 11,
            values: latestRotationVector
        });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}, 20);

server.listen(8080, '0.0.0.0', () => {
    console.log('=== Міст Node.js успішно запущено на порту 8080 ===');
    console.log('Очікування валідного потоку датчиків з iPhone...');
});