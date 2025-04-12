const dgram = require("dgram");
const WebSocket = require("ws");

const DISCOVERY_PORT = 9999;
const DISCOVERY_MESSAGE = "DISCOVERY_REQUEST";
const BROADCAST_INTERVAL = 5000;
const TIMEOUT_MS = 15000;

const host = dgram.createSocket("udp4");

const bots = new Map();
let broadcastIntervalID = null;

function startDiscovery() {
  if (broadcastIntervalID) return;

  broadcastIntervalID = setInterval(() => {
    showBots();
    sendDiscovery();
    cleanBots();
  }, BROADCAST_INTERVAL);
  console.log(`[DISCOVERY] Discovery started.`);
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
  const isNew = !bots.has(id);

  if (isNew && bots.size < 2) {
    console.log(`[DISCOVERY] Found new bot: ${data.name} @ ${data.url}`);
    const ws = new WebSocket(data.url);

    ws.on("open", () => {
      console.log(`[WS] Connected to ${data.name}`);
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && bots.size == 2) {
          console.log(`[WS] Sent move request to ${data.name}`);
          ws.send(JSON.stringify({ type: "MOVE_REQ" }));
        } else {
          clearInterval(interval);
        }
      }, 2000);
    });

    ws.on("message", (message) => {
      console.log(`[WS] Message from ${data.name}:`, message.toString());
    });

    ws.on("close", () => {
      console.log(`[WS] Disconnected from ${data.name}`);
      bots.delete(id);
      startDiscovery(); // restart discovery
    });

    ws.on("error", (err) => {
      console.log(`[WS] Error with ${data.name}:`, err.message);
      bots.delete(id);
      startDiscovery(); // restart discovery on error
    });

    bots.set(id, {
      ...data,
      ip: rinfo.address,
      lastSeen: Date.now(),
    });

    if (bots.size === 2) {
      stopDiscovery();
    }
  } else {
    const bot = bots.get(id);
    if (bot) bot.lastSeen = Date.now();
  }
});

function sendDiscovery() {
  if (bots.size >= 2) return;

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
  for (const [id, bot] of bots.entries()) {
    if (now - bot.lastSeen > TIMEOUT_MS) {
      console.log(`[CLEANUP] Removing inactive bot: ${bot.name} (${bot.ip})`);
      bots.delete(id);
      startDiscovery();
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
  startDiscovery();
});
