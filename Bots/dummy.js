const dgram = require("dgram");
const os = require("os");
const http = require("http");
const ws = require("ws");

const BOT_ID = process.env.BOT_ID || Math.random().toString(36).substring(2, 10);
const BOT_NAME = process.env.BOT_NAME || "UnnamedBot";
const WS_PORT = process.env.WS_PORT || 8081;
const UDP_PORT = 9999;
const DISCOVERY_MESSAGE = "DISCOVERY_REQUEST";

// Game state variables
let gridSize = 20;
let playerNum = 1;

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
      
      if (data.type === "GAME_CONFIG") {
        gridSize = data.gridSize;
        playerNum = data.playerNum;
        console.log(`[${BOT_NAME}] Game configured - Grid: ${gridSize}x${gridSize}, Player: ${playerNum}`);
      }
      else if (data.type === "MOVE_REQ") {
        const move = calculateMove(data);
        
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

// Movement logic
function calculateMove(gameState) {
  const head = gameState.mySnake[0];
  const food = gameState.food;
  
  // Possible moves with their direction and new position
  const possibleMoves = [
    { direction: "UP", x: head.x, y: head.y - 1 },
    { direction: "DOWN", x: head.x, y: head.y + 1 },
    { direction: "LEFT", x: head.x - 1, y: head.y },
    { direction: "RIGHT", x: head.x + 1, y: head.y }
  ];
  
  // Filter out invalid moves (wall collisions, snake collisions)
  const validMoves = possibleMoves.filter(move => {
    // Check wall collisions
    if (move.x < 0 || move.x >= gridSize || move.y < 0 || move.y >= gridSize) {
      return false;
    }
    
    // Check snake collisions (ignore tail since it moves)
    if (isPositionOccupied(move.x, move.y, gameState.mySnake) || 
        isPositionOccupied(move.x, move.y, gameState.opponentSnake)) {
      return false;
    }
    
    return true;
  });
  
  // If no valid moves, just go up (shouldn't happen in normal gameplay)
  if (validMoves.length === 0) {
    console.warn(`[${BOT_NAME}] No valid moves! Defaulting to UP`);
    return "UP";
  }
  
  // Find move that gets us closest to food (Manhattan distance)
  let bestMove = validMoves[0];
  let minDistance = calculateDistance(bestMove.x, bestMove.y, food.x, food.y);
  
  for (let i = 1; i < validMoves.length; i++) {
    const distance = calculateDistance(validMoves[i].x, validMoves[i].y, food.x, food.y);
    if (distance < minDistance) {
      bestMove = validMoves[i];
      minDistance = distance;
    }
  }
  
  return bestMove.direction;
}

function isPositionOccupied(x, y, snake) {
  // Don't consider the tail since it will move
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === x && snake[i].y === y) {
      return true;
    }
  }
  return false;
}

function calculateDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
