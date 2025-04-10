const dgram = require("dgram");
const os = require("os");

const BOT_ID = process.env.BOT_ID || Math.random().toString(36).substring(2, 10);
const BOT_NAME = process.env.BOT_NAME || "UnnamedBot";
const WS_PORT = process.env.WS_PORT || 8081;
const UDP_PORT = 9999;
const DISCOVERY_MESSAGE = "DISCOVERY_REQUEST";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === "IPv4" && !config.internal) {
        return config.address;
      }
    }
  }
}

const bot = dgram.createSocket({ type: "udp4", reuseAddr: true });

bot.on("message", (msg, rinfo) => {
  if (msg.toString() === DISCOVERY_MESSAGE) {
    const response = {
      id: BOT_ID,
      name: BOT_NAME,
      language: "node",
      url: `ws://${getLocalIP()}:${WS_PORT}/`
    };

    bot.send(Buffer.from(JSON.stringify(response)), rinfo.port, rinfo.address);
  }
});

bot.bind(UDP_PORT, () => {
  bot.setBroadcast(true);
  console.log(`[${BOT_NAME}] Listening for discovery on UDP ${UDP_PORT}`);
});


