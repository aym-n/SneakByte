const dgram = require("dgram");

const DISCOVERY_PORT = 9999;
const DISCOVERY_MESSAGE = "DISCOVERY_REQUEST";
const BROADCAST_INTERVAL = 5000;
const TIMEOUT_MS = 15000;

const host = dgram.createSocket("udp4");

const bots = new Map();

host.on("message", (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    const id = data.id;

    bots.set(id, {
      ...data,
      ip: rinfo.address,
      lastSeen: Date.now(),
    });
  } catch (err) {
    console.error("Invalid bot response:", msg.toString());
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
  for (const [id, bot] of bots.entries()) {
    if (now - bot.lastSeen > TIMEOUT_MS) {
      console.log(`[CLEANUP] Removing inactive bot: ${bot.name} (${bot.ip})`);
      bots.delete(id);
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

  setInterval(() => {
    sendDiscovery();
    cleanBots();
    showBots();
  }, BROADCAST_INTERVAL);
});
