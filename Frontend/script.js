const BACKEND_WS_URL = "ws://localhost:1726";

const statusDiv = document.getElementById("status");
const botSelectionDiv = document.getElementById("bot-selection");
const botListDiv = document.getElementById("bot-list");
const botForm = document.getElementById("bot-form");
const connectBotsBtn = document.getElementById("connect-bots-btn");
const connectionStatusDiv = document.getElementById("connection-status");
const botConnectionDetailsDiv = document.getElementById(
  "bot-connection-details",
);
const cancelConnectionBtn = document.getElementById("cancel-connection-btn");
const gameViewDiv = document.getElementById("game-view");
const gameInfoP = document.getElementById("game-info");
const gameEndReasonP = document.getElementById("game-end-reason");
const disconnectBtn = document.getElementById("disconnect-btn");

let socket = null;
let availableBots = [];
let selectedBots = new Set();
let connectionAttemptActive = false;

function setStatus(message, type = "info") {
  statusDiv.textContent = message;
  statusDiv.className = `status-${type}`;
}

function connectWebSocket() {
  setStatus("Connecting to backend...", "info");
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    console.log("WebSocket connection already open or connecting.");
    return;
  }

  socket = new WebSocket(BACKEND_WS_URL);

  socket.onopen = () => {
    setStatus("Connected. Waiting for bot list...", "success");
    console.log("WebSocket connection established");
    showView("bot-selection");
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Message from server:", message);

      switch (message.type) {
        case "BOT_LIST":
          availableBots = message.bots || [];
          if (botSelectionDiv.style.display !== "none") {
            const currentAvailableIds = new Set(availableBots.map((b) => b.id));
            selectedBots.forEach((id) => {
              if (!currentAvailableIds.has(id)) {
                selectedBots.delete(id);
              }
            });
            updateBotListView();
            updateConnectButtonState();
            setStatus(
              `Connected. Found ${availableBots.length} bot(s).`,
              "success",
            );
          }
          break;

        case "GAME_STARTED":
          connectionAttemptActive = false;
          setStatus("Game started successfully!", "success");
          gameInfoP.textContent = `Playing: ${message.bots.join(" vs ")}`;
          gameEndReasonP.style.display = "none";
          
          // Store game information in sessionStorage before navigating
          sessionStorage.setItem("gameInProgress", "true");
          sessionStorage.setItem("botIds", JSON.stringify(message.botIds));
          sessionStorage.setItem("botNames", JSON.stringify(message.bots));
          
          // Now show the game interface
          showGameInterface();
          break;

        case "GAME_START_ERROR":
          connectionAttemptActive = false;
          setStatus(`Error starting game: ${message.message}`, "error");
          botConnectionDetailsDiv.innerHTML = `<p class="status-error">Failed: ${message.message}</p>`;
          cancelConnectionBtn.style.display = "block";
          showView("connection-status");
          break;

        case "GAME_ENDED":
          if (gameViewDiv.style.display !== "none") {
            setStatus(`Game ended: ${message.reason}`, "ended");
            gameEndReasonP.textContent = `Reason: ${message.reason}`;
            gameEndReasonP.style.display = "block";
          } else {
            setStatus(`Game ended prematurely: ${message.reason}`, "warning");
            showView("bot-selection");
          }
          connectionAttemptActive = false;
          break;
          
        default:
          console.log("Received unknown message type:", message.type);
      }
    } catch (error) {
      console.error(
        "Failed to parse message or process update:",
        event.data,
        error,
      );
      setStatus("Error processing message from backend.", "error");
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket Error:", error);
    setStatus("WebSocket connection error. Please refresh.", "error");
    showView("bot-selection");
    disableBotSelection();
    connectionAttemptActive = false;
  };

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    setStatus("Disconnected. Attempting to reconnect...", "warning");
    showView("bot-selection");
    disableBotSelection();
    availableBots = [];
    selectedBots.clear();
    updateBotListView();
    updateConnectButtonState();
    connectionAttemptActive = false;
    setTimeout(connectWebSocket, 5000);
  };
}

function showGameInterface() {
  const useGamePage = true; 
  
  if (useGamePage) {
    // Navigate to separate game page
    window.location.href = "game.html";
  } else {
    showView("game-view");
  }
}

function showView(viewId) {
  botSelectionDiv.style.display = "none";
  connectionStatusDiv.style.display = "none";
  gameViewDiv.style.display = "none";

  const viewToShow = document.getElementById(viewId);
  if (viewToShow) {
    viewToShow.style.display = "block";
  }

  if (viewId === "bot-selection") {
    enableBotSelection();
    connectionAttemptActive = false;
  }
  if (viewId === "connection-status") {
    cancelConnectionBtn.style.display = "none";
  }
}

function updateBotListView() {
  botListDiv.innerHTML = "";
  if (availableBots.length === 0) {
    botListDiv.innerHTML = "<p>No active bots found yet.</p>";
  } else {
    availableBots.forEach((bot) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = bot.id;
      checkbox.id = `bot-${bot.id}`;
      checkbox.checked = selectedBots.has(bot.id);
      checkbox.addEventListener("change", handleCheckboxChange);
      checkbox.disabled = !isSocketOpen();
      label.appendChild(checkbox);
      label.appendChild(
        document.createTextNode(` ${bot.name} (ID: ${bot.id})`),
      );
      botListDiv.appendChild(label);
    });
  }
  updateConnectButtonState();
}

function handleCheckboxChange(event) {
  const botId = event.target.value;
  if (event.target.checked) {
    selectedBots.add(botId);
  } else {
    selectedBots.delete(botId);
  }
  updateConnectButtonState();
}

function updateConnectButtonState() {
  const numSelected = selectedBots.size;
  const requiredBots = 2;
  const canConnect =
    numSelected === requiredBots && isSocketOpen() && !connectionAttemptActive;

  connectBotsBtn.disabled = !canConnect;

  if (!isSocketOpen()) {
    connectBotsBtn.textContent = "Connecting...";
  } else if (numSelected < requiredBots) {
    connectBotsBtn.textContent = `Select ${requiredBots - numSelected} more bot(s)`;
  } else if (numSelected > requiredBots) {
    connectBotsBtn.textContent = `Too many selected (${numSelected})`;
    connectBotsBtn.disabled = true;
  } else {
    connectBotsBtn.textContent = "Connect Bots";
  }
}

function disableBotSelection() {
  const checkboxes = botListDiv.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb) => (cb.disabled = true));
  connectBotsBtn.disabled = true;
  connectBotsBtn.textContent = "Unavailable";
}

function enableBotSelection() {
  if (isSocketOpen()) {
    const checkboxes = botListDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => (cb.disabled = false));
    updateConnectButtonState();
  } else {
    disableBotSelection();
  }
}

function isSocketOpen() {
  return socket && socket.readyState === WebSocket.OPEN;
}

botForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (selectedBots.size === 2 && isSocketOpen()) {
    const botIds = Array.from(selectedBots);
    console.log("Sending START_GAME command with IDs:", botIds);

    botConnectionDetailsDiv.innerHTML = "";
    botIds.forEach((id) => {
      const botName =
        availableBots.find((b) => b.id === id)?.name || `ID: ${id}`;
      const statusP = document.createElement("p");
      statusP.classList.add("bot-status", "status-connecting");
      statusP.textContent = `Attempting connection to ${botName}...`;
      botConnectionDetailsDiv.appendChild(statusP);
    });
    cancelConnectionBtn.style.display = "block";
    showView("connection-status");
    setStatus("Attempting to start game with selected bots...", "warning");
    disableBotSelection();
    connectionAttemptActive = true;
    updateConnectButtonState();

    socket.send(JSON.stringify({ type: "START_GAME", botIds: botIds }));
  } else if (!isSocketOpen()) {
    setStatus("Not connected to the backend.", "error");
  } else {
    setStatus("Please select exactly two bots.", "warning");
  }
});

cancelConnectionBtn.addEventListener("click", () => {
  console.log("Connection attempt cancelled by user.");
  connectionAttemptActive = false;
  showView("bot-selection");
  setStatus("Connection cancelled. Select bots.", "info");
});

disconnectBtn.addEventListener("click", () => {
  console.log("Disconnect button clicked, returning to selection.");
  showView("bot-selection");
  setStatus("Disconnected. Select bots for a new game.", "info");
  // Inform backend the game is canceled
  if (isSocketOpen()) {
    socket.send(JSON.stringify({ type: "CANCEL_GAME" }));
  }
});

connectWebSocket();