const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Alphabet coop server running.\n");
});

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map();

const getRoom = (code) => {
  if (!rooms.has(code)) rooms.set(code, { clients: new Set(), host: null });
  return rooms.get(code);
};

const removeClient = (code, ws) => {
  const room = rooms.get(code);
  if (!room) return;
  room.clients.delete(ws);
  if (room.host === ws) room.host = null;
  if (room.clients.size === 0) rooms.delete(code);
};

const broadcast = (code, sender, msg) => {
  const room = rooms.get(code);
  if (!room) return;
  for (const client of room.clients) {
    if (client.readyState !== client.OPEN) continue;
    if (client === sender) continue;
    client.send(JSON.stringify(msg));
  }
};

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg = null;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      return;
    }

    if (msg.type === "HELLO") {
      const payload = msg.payload || {};
      const code = (payload.code || "").toUpperCase();
      const role = payload.role || "join";

      if (!code) {
        ws.send(JSON.stringify({ type: "HELLO_ERR", payload: { code: "INVALID_CODE", message: "Code invalide." } }));
        return;
      }

      const existing = rooms.get(code);
      if (role === "host" && existing && existing.host) {
        ws.send(JSON.stringify({ type: "HELLO_ERR", payload: { code: "ROOM_EXISTS", message: "Partie déjà existante." } }));
        return;
      }

      if (role === "join" && (!existing || !existing.host)) {
        ws.send(JSON.stringify({ type: "HELLO_ERR", payload: { code: "ROOM_NOT_FOUND", message: "Aucune partie trouvée." } }));
        return;
      }

      const room = getRoom(code);
      room.clients.add(ws);
      if (role === "host") room.host = ws;
      ws.roomCode = code;
      ws.role = role;

      ws.send(JSON.stringify({ type: "HELLO_OK" }));
      return;
    }

    const code = msg.code || ws.roomCode;
    if (!code) return;

    broadcast(code, ws, { type: msg.type, payload: msg.payload });
  });

  ws.on("close", () => {
    const code = ws.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (room && room.host === ws) {
      for (const client of room.clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "ROOM_CLOSED", payload: { message: "Le host a quitté la partie." } }));
          client.close();
        }
      }
      rooms.delete(code);
      return;
    }

    removeClient(code, ws);
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/coop") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

server.listen(PORT, () => {
  console.log(`Alphabet coop server listening on :${PORT}`);
});
