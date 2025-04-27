const dgram = require("dgram");
const os = require("os");
const http = require("http");
const ws = require("ws");

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
      url: `ws://${getLocalIP()}:${WS_PORT}/`,
    };
    bot.send(Buffer.from(JSON.stringify(response)), rinfo.port, rinfo.address);
  }
});

bot.bind(UDP_PORT, () => {
  bot.setBroadcast(true);
  console.log(`[${BOT_NAME}] Listening for discovery on UDP ${UDP_PORT}`);
});

const server = http.createServer();
const wss = new ws.Server({ server });

wss.on("connection", (ws) => {
  console.log(`[${BOT_NAME}] Host connected via WebSocket`);
  
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[${BOT_NAME}] Received: ${message}`);
      
      if (data.type === "MOVE_REQ") {
        // Using UPPERCASE direction to match what game.js expects
        const directions = ["UP", "DOWN", "LEFT", "RIGHT"];
        const move = directions[Math.floor(Math.random() * directions.length)];
        
        ws.send(JSON.stringify({ 
          type: "MOVE_RESP", 
          direction: move 
        }));
        
        console.log(`[${BOT_NAME}] Sent move: ${move}`);
      }
    } catch (err) {
      console.error(`[${BOT_NAME}] Error processing message: ${err.message}`);
    }
  });
  
  ws.on("close", () => {
    console.log(`[${BOT_NAME}] Host disconnected`);
  });
  
  ws.on("error", (err) => {
    console.error(`[${BOT_NAME}] WebSocket error: ${err.message}`);
  });
});

server.listen(WS_PORT, () => {
  console.log(
    `[${BOT_NAME}] WebSocket server running at ws://${getLocalIP()}:${WS_PORT}`,
  );
});