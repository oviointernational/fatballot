import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import app, { setBroadcastLiveResults } from './app';
import { db } from './database';
import { auditLedger } from './auditLedger';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Wire real-time broadcasts into the Express app for local/dev usage.
// Serverless deployments (Vercel) use client polling instead.
setBroadcastLiveResults(() => {
  const liveData = db.getLiveResults();
  const payload = JSON.stringify({ type: 'LIVE_RESULTS_UPDATE', data: liveData });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'LIVE_RESULTS_UPDATE', data: db.getLiveResults() }));
});

async function start() {
  await db.init();
  await auditLedger.init();
  server.listen(PORT, () => {
    console.log(`FatBallot Server active on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start FatBallot server:', err);
  process.exit(1);
});