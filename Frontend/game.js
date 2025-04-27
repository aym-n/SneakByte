document.addEventListener('DOMContentLoaded', () => {
    // Game constants
    const GRID_SIZE = 30; // Increased from 20 to 30
    const GAME_SPEED = 150;
    const INITIAL_LENGTH = 4;
    const GAME_DURATION = 60; // Increased from 30 to 60 seconds for a longer game
  
    // Game directions
    const DIRECTIONS = {
      UP: { x: 0, y: -1 },
      DOWN: { x: 0, y: 1 },
      LEFT: { x: -1, y: 0 },
      RIGHT: { x: 1, y: 0 }
    };
  
    // Game state variables
    let snake1 = [];
    let snake2 = [];
    let dir1 = DIRECTIONS.DOWN;
    let dir2 = DIRECTIONS.DOWN;
    let food = { x: 15, y: 15 }; // Adjusted for larger grid
    let score1 = 0;
    let score2 = 0;
    let gameOver = false;
    let winner = null;
    let gameStarted = false;
    let timer = GAME_DURATION;
    
    // Game loop references
    let gameLoopInterval = null;
    let timerInterval = null;
    
    // WebSocket connection
    let socket = null;
    let player1Id = null;
    let player2Id = null;
    
    // DOM elements
    const gameGrid = document.getElementById('game-grid');
    const startButton = document.getElementById('start-button');
    const score1Element = document.getElementById('score1');
    const score2Element = document.getElementById('score2');
    const timerElement = document.getElementById('timer');
    const statusElement = document.getElementById('status');
    
    // Connect to the WebSocket server
    function connectWebSocket() {
      const BACKEND_WS_URL = "ws://localhost:1726";
      socket = new WebSocket(BACKEND_WS_URL);
      
      socket.onopen = () => {
        setStatus("Connected to game server", "success");
        console.log("WebSocket connection established");
        
        // Retrieve stored bot information
        const storedBotIds = JSON.parse(sessionStorage.getItem("botIds") || "[]");
        if (storedBotIds.length === 2) {
          player1Id = storedBotIds[0];
          player2Id = storedBotIds[1];
          
          // Tell the server to reconnect to the bots
          socket.send(JSON.stringify({
            type: "RECONNECT_GAME",
            botIds: storedBotIds
          }));
          
          setStatus("Reconnecting to bots...", "info");
        } else {
          setStatus("No bot information found", "error");
        }
      };
    
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Message from server:", message);
          
          switch (message.type) {
            case "GAME_STARTED":
              setStatus(`Game started: ${message.bots.join(" vs ")}`, "success");
              player1Id = message.botIds[0];
              player2Id = message.botIds[1];
              startGame();
              break;
              
            case "BOT_MOVE":
              handleBotMove(message.botId, message.direction);
              break;
              
            case "GAME_ENDED":
              setStatus(`Game ended: ${message.reason}`, "ended");
              endGame();
              break;
              
            default:
              console.log("Received unknown message type:", message.type);
          }
        } catch (error) {
          console.error("Failed to parse message:", event.data, error);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setStatus("Connection error. Please refresh.", "error");
      };
      
      socket.onclose = () => {
        console.log("WebSocket connection closed");
        setStatus("Disconnected from server", "warning");
        setTimeout(connectWebSocket, 5000);
      };
    }
    
    // Set status message
    function setStatus(message, type = "info") {
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-${type}`;
      }
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    // Handle bot move messages from server
    function handleBotMove(botId, direction) {
      if (!gameStarted || gameOver) return;
      
      if (botId === player1Id) {
        switch (direction) {
          case "UP": if (dir1.y !== 1) dir1 = DIRECTIONS.UP; break;
          case "DOWN": if (dir1.y !== -1) dir1 = DIRECTIONS.DOWN; break;
          case "LEFT": if (dir1.x !== 1) dir1 = DIRECTIONS.LEFT; break;
          case "RIGHT": if (dir1.x !== -1) dir1 = DIRECTIONS.RIGHT; break;
        }
      } else if (botId === player2Id) {
        switch (direction) {
          case "UP": if (dir2.y !== 1) dir2 = DIRECTIONS.UP; break;
          case "DOWN": if (dir2.y !== -1) dir2 = DIRECTIONS.DOWN; break;
          case "LEFT": if (dir2.x !== 1) dir2 = DIRECTIONS.LEFT; break;
          case "RIGHT": if (dir2.x !== -1) dir2 = DIRECTIONS.RIGHT; break;
        }
      }
    }
    
    // Initialize game
    function initGame() {
      // Initialize snakes - position them further apart for the larger grid
      snake1 = Array(INITIAL_LENGTH).fill().map((_, i) => ({ x: 8, y: 15 - i }));
      snake2 = Array(INITIAL_LENGTH).fill().map((_, i) => ({ x: 22, y: 15 - i }));
      
      // Set default directions
      dir1 = DIRECTIONS.DOWN;
      dir2 = DIRECTIONS.DOWN;
      
      // Reset scores
      score1 = 0;
      score2 = 0;
      updateScore();
      
      // Reset game state
      gameOver = false;
      winner = null;
      
      // Reset timer
      timer = GAME_DURATION;
      updateTimer();
      
      // Create initial food
      food = createFood([snake1, snake2]);
      
      // Render initial grid
      renderGrid();
    }
    
    // Create grid
    function createGrid() {
      gameGrid.innerHTML = '';
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = document.createElement('div');
        row.className = 'grid-row';
        
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.id = `cell-${y}-${x}`;
          // Make cells smaller for larger grid
          cell.style.width = `${500/GRID_SIZE}px`;
          cell.style.height = `${500/GRID_SIZE}px`;
          row.appendChild(cell);
        }
        
        gameGrid.appendChild(row);
      }
    }
    
    // Render grid based on game state
    function renderGrid() {
      // Clear all cells
      const cells = document.querySelectorAll('.grid-cell');
      cells.forEach(cell => {
        cell.className = 'grid-cell';
      });
      
      // Render snakes
      snake1.forEach(segment => {
        const cell = document.getElementById(`cell-${segment.y}-${segment.x}`);
        if (cell) cell.classList.add('snake1');
      });
      
      snake2.forEach(segment => {
        const cell = document.getElementById(`cell-${segment.y}-${segment.x}`);
        if (cell) cell.classList.add('snake2');
      });
      
      // Render food
      const foodCell = document.getElementById(`cell-${food.y}-${food.x}`);
      if (foodCell) foodCell.classList.add('food');
    }
    
    // Create food at random position
    function createFood(snakes) {
      const newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      
      const isOnSnake = snakes.some(snake =>
        snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)
      );
      
      return isOnSnake ? createFood(snakes) : newFood;
    }
    
    // Wrap position around grid boundaries
    function wrapPosition(pos) {
      return {
        x: (pos.x + GRID_SIZE) % GRID_SIZE,
        y: (pos.y + GRID_SIZE) % GRID_SIZE
      };
    }
    
    // Check for collision with snake
    function checkCollision(head, snake) {
      return snake.some((segment, index) => 
        index !== 0 && segment.x === head.x && segment.y === head.y
      );
    }
    
    // Update score display
    function updateScore() {
      score1Element.textContent = score1;
      score2Element.textContent = score2;
    }
    
    // Update timer display
    function updateTimer() {
      timerElement.textContent = `${timer}s`;
    }
    
    // Send game state to server
    function sendGameState() {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "GAME_STATE",
          snake1: snake1,
          snake2: snake2,
          food: food,
          score1: score1,
          score2: score2,
          timer: timer
        }));
      }
    }
    
    // Show game over modal
    function showGameOver() {
      // Make sure we have a valid winner before showing the modal
      if (winner === null) {
        winner = score1 > score2 ? 'Player 1' : score2 > score1 ? 'Player 2' : 'tie';
      }
      
      const gameOverElement = document.createElement('div');
      gameOverElement.className = 'game-over';
      gameOverElement.innerHTML = `
        <div class="game-over-modal">
          <h2 class="game-over-title">${winner === 'tie' ? 'It\'s a tie!' : `${winner} wins!`}</h2>
          
        </div>
      `;
      
      gameGrid.appendChild(gameOverElement);
      
      // Automatically go back to selection screen after a delay
      setTimeout(() => {
        navigateToSelection();
      }, 2000);
      
      // Add event listener for immediate return button
      document.getElementById('back-to-selection').addEventListener('click', navigateToSelection);
    }
    
    // Navigate back to bot selection
    function navigateToSelection() {
      // Clear session storage to reset the game state
      sessionStorage.removeItem("gameInProgress");
      
      // Navigate back to the main page
      window.location.href = "index.html";
    }
    
    // Game loop function
    function gameLoop() {
      let newHead1 = wrapPosition({ x: snake1[0].x + dir1.x, y: snake1[0].y + dir1.y });
      let newHead2 = wrapPosition({ x: snake2[0].x + dir2.x, y: snake2[0].y + dir2.y });
  
      const s1Self = checkCollision(newHead1, snake1);
      const s1HitS2 = checkCollision(newHead1, snake2);
      const s2Self = checkCollision(newHead2, snake2);
      const s2HitS1 = checkCollision(newHead2, snake1);
      const headOn = newHead1.x === newHead2.x && newHead1.y === newHead2.y;
  
      if (s1Self || s1HitS2 || s2Self || s2HitS1 || headOn) {
        // Determine winner
        if ((s1Self || s1HitS2) && (s2Self || s2HitS1) || headOn) {
          winner = score1 > score2 ? 'Player 1' : score2 > score1 ? 'Player 2' : 'tie';
        } else if (s1Self || s1HitS2) {
          winner = 'Player 2';
        } else {
          winner = 'Player 1';
        }
        
        // Send game over notification to server
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "GAME_OVER",
            winner: winner,
            reason: "Collision"
          }));
        }
        
        // End game and show game over screen
        endGame();
        return;
      }
  
      let newSnake1 = [newHead1, ...snake1];
      let newSnake2 = [newHead2, ...snake2];
  
      if (newHead1.x === food.x && newHead1.y === food.y) {
        score1++;
        updateScore();
      } else {
        newSnake1.pop();
      }
  
      if (newHead2.x === food.x && newHead2.y === food.y) {
        score2++;
        updateScore();
      } else {
        newSnake2.pop();
      }
  
      if ((newHead1.x === food.x && newHead1.y === food.y) || (newHead2.x === food.x && newHead2.y === food.y)) {
        food = createFood([newSnake1, newSnake2]);
      }
  
      snake1 = newSnake1;
      snake2 = newSnake2;
      
      renderGrid();
      sendGameState();
    }
    
    // Start game
    function startGame() {
      if (gameStarted) return;
      
      gameStarted = true;
      if (startButton) {
        startButton.textContent = 'Restart Game';
      }
      
      // Initialize game state
      initGame();
      
      // Start game loop
      gameLoopInterval = setInterval(gameLoop, GAME_SPEED);
      
      // Start timer
      timerInterval = setInterval(() => {
        timer--;
        updateTimer();
        
        if (timer <= 0) {
          // Determine winner based on score when time runs out
          winner = score1 > score2 ? 'Player 1' : score2 > score1 ? 'Player 2' : 'tie';
          
          // Send game over notification to server
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "GAME_OVER",
              winner: winner,
              reason: "Time limit reached"
            }));
          }
          
          endGame();
        }
      }, 1000);
    }
    
    // End game
    function endGame() {
      gameOver = true;
      clearInterval(gameLoopInterval);
      clearInterval(timerInterval);
      showGameOver();
    }
    
    // Initialize
    createGrid();
    initGame();
    connectWebSocket();
    
    // Add event listener for start button (if it exists in this view)
    if (startButton) {
      startButton.addEventListener('click', () => {
        if (gameStarted) {
          // Instead of restarting, go back to selection
          navigateToSelection();
        } else {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "REQUEST_START_GAME"
            }));
            setStatus("Requesting game start...", "info");
          } else {
            setStatus("Not connected to server", "error");
          }
        }
      });
    }
  });