const dgram = require("dgram");
const WebSocket = require("ws");

const DISCOVERY_PORT = 9999;
const DISCOVERY_MESSAGE = "DISCOVERY_REQUEST";
const BROADCAST_INTERVAL = 5000;
const TIMEOUT_MS = 15000;

const FRONTEND_WS_PORT = 1726;

const host = dgram.createSocket("udp4");

const bots = new Map();
let activeBots = new Map();
let frontendWS = null;
let broadcastIntervalID = null;

const wss = new WebSocket.Server({ port: FRONTEND_WS_PORT });
console.log(`[FRONTEND WS] server started on port ${FRONTEND_WS_PORT}`);

wss.on("connection", (ws) => {
  console.log("[FRONTEND WS] Connected!");
  frontendWS = ws;

  sendBotList();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log("[Frontend WS] Message received:", data);

      if (
        data.type === "START_GAME" &&
        data.botIds &&
        data.botIds.length === 2
      ) {
        startGame(data.botIds);
      } else {
        console.warn(
          "[Frontend WS] Unknown message type or invalid data:",
          data,
        );
      }
    } catch (err) {
      console.error(
        "[Frontend WS] Failed to parse message or invalid message format:",
        message.toString(),
        err,
      );
    }
  });

  ws.on("close", () => {
    console.log("[FRONTEND WS] Frontend disconnected");
    frontendWS = null;
    stopGame();
  });

  ws.on("error", (err) => {
    console.error("[Frontend WS] Error:", err.message);
    if (frontendWS === ws) {
      frontendWS = null;
    }
    stopGame();
  });
});

function sendBotList() {
  if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
    const botList = Array.from(bots.values()).map((bot) => ({
      id: bot.id,
      name: bot.name,
    }));
    frontendWS.send(JSON.stringify({ type: "BOT_LIST", bots: botList }));
    console.log(`[FRONTEND WS] Sent bot list update (${botList.length} bots)`);
  }
}

function startDiscovery() {
  if (broadcastIntervalID) return;

  broadcastIntervalID = setInterval(() => {
    // showBots();
    sendDiscovery();
    cleanBots();
  }, BROADCAST_INTERVAL);
  console.log(`[DISCOVERY] Discovery started.`);
  sendDiscovery();
}

function stopDiscovery() {
  if (broadcastIntervalID) {
    clearInterval(broadcastIntervalID);
    broadcastIntervalID = null;
    console.log(`[DISCOVERY] Discovery stopped.`);
  }
}

host.on("message", (msg, rinfo) => {
  let data;
  try {
    data = JSON.parse(msg.toString());
  } catch (err) {
    console.error("[DISCOVERY] Invalid message:", msg.toString());
    return;
  }

  const id = data.id;
  const botInfo = {
    ...data,
    ip: rinfo.address,
    lastSeen: Date.now(),
  };
  const isNew = !bots.has(id);
  bots.set(id, botInfo);
  if (isNew) {
    console.log(
      `[DISCOVERY] Found new bot: ${data.name} (${id}) @ ${data.url}`,
    );
    sendBotList();
  }
});

function sendDiscovery() {
  const message = Buffer.from(DISCOVERY_MESSAGE);
  host.send(
    message,
    0,
    message.length,
    DISCOVERY_PORT,
    "255.255.255.255",
    () => {
      console.log(
        `[DISCOVERY] Sent broadcast at ${new Date().toLocaleTimeString()}`,
      );
    },
  );
}

function cleanBots() {
  const now = Date.now();
  let changed = false;
  for (const [id, bot] of bots.entries()) {
    if (now - bot.lastSeen > TIMEOUT_MS) {
      console.log(`[CLEANUP] Removing inactive bot: ${bot.name} (${bot.ip})`);
      bots.delete(id);
      changed = true;
    }
  }

  if (changed) {
    sendBotList();
  }
}

function startGame(botIds) {
  console.log(
    `[GAME] Attempting to start game with bots: ${botIds.join(", ")}`,
  );
  stopGame();

  const bot1Info = bots.get(botIds[0]);
  const bot2Info = bots.get(botIds[1]);

  if (!bot1Info || !bot2Info) {
    console.error(
      "[GAME] Could not find information for one or both selected bots.",
    );

    if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
      frontendWS.send(
        JSON.stringify({
          type: "GAME_START_ERROR",
          message: "Selected bot(s) not found or timed out.",
        }),
      );
    }
    return;
  }

  console.log(`[GAME] Connecting to ${bot1Info.name} at ${bot1Info.url}`);
  const ws1 = connectToBot(bot1Info);
  activeBots.set(bot1Info.id, ws1);

  console.log(`[GAME] Connecting to ${bot2Info.name} at ${bot2Info.url}`);
  const ws2 = connectToBot(bot2Info);
  activeBots.set(bot2Info.id, ws2);

  if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
    frontendWS.send(
      JSON.stringify({
        type: "GAME_STARTED",
        bots: [bot1Info.name, bot2Info.name],
      }),
    );
  }
  stopDiscovery();
}

function connectToBot(botInfo) {
  const ws = new WebSocket(botInfo.url);

  ws.on("open", () => {
    console.log(`[GAME WS] Connected to ${botInfo.name}`);
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`[GAME WS] Sent move request to ${botInfo.name}`);
        ws.send(JSON.stringify({ type: "MOVE_REQ" }));
      } else {
        clearInterval(interval);
      }
    }, 500);
    ws.gameUpdateInterval = interval;
  });

  ws.on("message", (message) => {
    console.log(`[GAME WS] Message from ${botInfo.name}:`, message.toString());
    // TODO: Implement Game Logic
  });

  ws.on("close", () => {
    console.log(`[GAME WS] Disconnected from ${botInfo.name}`);
    if (activeBots.has(botInfo.id)) {
      activeBots.delete(botInfo.id);
      stopGame();
      if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
        frontendWS.send(
          JSON.stringify({
            type: "GAME_ENDED",
            reason: `${botInfo.name} disconnected.`,
          }),
        );
      }
    }
  });

  ws.on("error", (err) => {
    console.error(`[GAME WS] Error with ${botInfo.name}:`, err.message);
    if (activeBots.has(botInfo.id)) {
      activeBots.delete(botInfo.id);
      stopGame();
      if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
        frontendWS.send(
          JSON.stringify({
            type: "GAME_ENDED",
            reason: `Connection error with ${botInfo.name}.`,
          }),
        );
      }
    }
  });
  return ws;
}

function stopGame() {
  console.log("[GAME] Stopping game and closing bot connections...");
  for (const [id, ws] of activeBots.entries()) {
    if (ws.gameUpdateInterval) {
      clearInterval(ws.gameUpdateInterval);
    }
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.terminate();
      console.log(`[GAME] Terminated connection to bot ${id}`);
    }
  }
  activeBots.clear();

  if (frontendWS && frontendWS.readyState === WebSocket.OPEN) {
    try {
      frontendWS.send(
        JSON.stringify({
          type: "GAME_ENDED",
          reason: `Game stopped by backend.`,
        }),
      );
    } catch (e) {
      console.warn(
        "[Frontend WS] Could not send GAME_ENDED message, frontend likely already closed.",
      );
    }
  }
}

function showBots() {
  console.log(`\nActive bots (${bots.size}):`);
  for (const bot of bots.values()) {
    console.log(`- ${bot.name} @ ${bot.url}`);
  }
}

host.bind(() => {
  host.setBroadcast(true);
  console.log("[DISCOVERY] UDP Host bound and broadcast enabled.");
  startDiscovery();
});

console.log("[DISCOVERY] Starting discovery service...");
