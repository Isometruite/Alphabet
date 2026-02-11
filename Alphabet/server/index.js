import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Alphabet WS server running");
});

const wss = new WebSocketServer({ server });

// roomId -> Set of sockets
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function send(ws, obj) {
  if (ws.readyState === 1) { // 1 = OPEN
    ws.send(JSON.stringify(obj));
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // S'assure qu'on est bien sur /coop (évite /coop/ ou /coop/coop selon ton front)
  if (url.pathname !== "/coop") {
    ws.close(1008, "Wrong path");
    return;
  }

  const roomId = (url.searchParams.get("room") || "").trim();
  const playerId =
    (url.searchParams.get("player") || "").trim() ||
    `p_${Math.random().toString(16).slice(2)}`;

  if (!roomId) {
    // Autorise une connexion "probe" (test) sans room
    send(ws, { t: "server_ok" });
    return;
  }

  ws._roomId = roomId;
  ws._playerId = playerId;

  const room = getRoom(roomId);
  room.add(ws);

  send(ws, {
    t: "welcome",
    room: roomId,
    player: playerId,
    peers: [...room].filter(x => x !== ws).map(x => x._playerId)
  });

  for (const peer of room) {
    if (peer !== ws) send(peer, { t: "peer_join", player: playerId });
  }

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    for (const peer of room) {
      if (peer === ws) continue;
      send(peer, { ...msg, _from: playerId });
    }
  });

  ws.on("close", () => {
    const r = rooms.get(ws._roomId);
    if (!r) return;
    r.delete(ws);

    if (r.size === 0) rooms.delete(ws._roomId);
    else for (const peer of r) send(peer, { t: "peer_leave", player: playerId });
  });
});

server.listen(PORT, () => {
  console.log(`WS listening on port ${PORT} (path /coop)`);
});
