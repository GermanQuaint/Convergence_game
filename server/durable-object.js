export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = {}; // Use an object to store sessions by their unique ID

    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("gameState");
      this.gameState = stored || {
        players: {}, // Will store player1 and player2
        questions: JSON.parse(this.env.QUESTIONS).sort(() => Math.random() - 0.5),
        currentQuestion: 0,
        history: [],
        gameId: null, // Will store the short, human-readable game ID
      };
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected websocket upgrade", { status: 426 });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    const socketId = Math.random().toString(36).substring(2, 10); // Unique ID for this WebSocket connection
    this.sessions[socketId] = webSocket;

    // Send initial game state to the newly connected client
    this.sendToSocket(webSocket, { type: 'gameUpdate', payload: this.gameState });

    webSocket.addEventListener("message", async msg => {
      try {
        const message = JSON.parse(msg.data);
        await this.handleMessage(message, socketId); // Pass socketId to identify the sender
      } catch (err) {
        this.sendToSocket(webSocket, { type: "gameError", payload: "Invalid message format" });
      }
    });

    webSocket.addEventListener("close", async () => {
      delete this.sessions[socketId];
      // Remove player's socketId association on disconnect
      for (const playerKey in this.gameState.players) {
        if (this.gameState.players[playerKey] && this.gameState.players[playerKey].socketId === socketId) {
          this.gameState.players[playerKey].socketId = null; // Mark as disconnected
          break;
        }
      }
      await this.state.storage.put("gameState", this.gameState);
      this.broadcast({ type: 'gameUpdate', payload: this.gameState });
    });

    webSocket.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });
  }

  async handleMessage(message, socketId) {
    const { type, payload } = message;

    let playerKey = null; // 'player1' or 'player2'
    // Find which player this socketId belongs to
    for (const key in this.gameState.players) {
      if (this.gameState.players[key] && this.gameState.players[key].socketId === socketId) {
        playerKey = key;
        break;
      }
    }

    switch (type) {
      case 'createGame':
        // This message should only come from the first player
        if (!this.gameState.players.player1) {
          this.gameState.players.player1 = { name: payload.player1Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false, socketId: socketId };
          this.gameState.gameId = payload.gameId; // Set the short gameId from the client
          this.broadcast({ type: 'gameCreated', payload: this.gameState.gameId });
        } else {
          this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Игра уже создана.' });
        }
        break;

      case 'joinGame':
        // This message should only come from the second player
        if (!this.gameState.players.player2 && this.gameState.players.player1) {
          const existingPlayerNames = Object.values(this.gameState.players).map(p => p.name);
          if (existingPlayerNames.includes(payload.player2Name)) {
            this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Это имя уже занято в данной игре. Пожалуйста, выберите другое имя.' });
            return;
          }
          this.gameState.players.player2 = { name: payload.player2Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false, socketId: socketId };
        } else {
          this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Игра не найдена или уже заполнена' });
        }
        break;

      case 'answer':
        if (playerKey) {
          this.gameState.players[playerKey].answer = payload.answer;
          this.gameState.players[playerKey].hasAnswered = true;

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasAnswered)) {
            if (!this.gameState.history) {
              this.gameState.history = [];
            }
            this.gameState.history[this.gameState.currentQuestion] = {
              player1: this.gameState.players.player1.answer,
              player2: this.gameState.players.player2.answer,
            };
            this.gameState.players.player1.answer = null;
            this.gameState.players.player2.answer = null;

            this.broadcast({ type: 'gameUpdate', payload: this.gameState });
            setTimeout(() => {
              this.broadcast({ type: 'showReveal', payload: { questionIndex: this.gameState.currentQuestion } });
            }, 1000);
          }
        }
        break;

      case 'nextQuestion':
        if (playerKey) {
          this.gameState.players[playerKey].hasClickedNext = true;

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasClickedNext)) {
            if (this.gameState.currentQuestion < this.gameState.questions.length - 1) {
              this.gameState.currentQuestion++;
              this.gameState.players.player1.hasAnswered = false;
              this.gameState.players.player1.hasClickedNext = false;
              this.gameState.players.player2.hasAnswered = false;
              this.gameState.players.player2.hasClickedNext = false;

              this.broadcast({ type: 'gameUpdate', payload: this.gameState });
              this.broadcast({ type: 'showAnswerScreen' });
            }
          }
        }
        break;

      case 'prevQuestion':
        if (this.gameState.currentQuestion > 0) {
          this.gameState.currentQuestion--;
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showReveal', payload: { questionIndex: this.gameState.currentQuestion } });
        }
        break;

      case 'restartCurrentQuestion':
        if (this.gameState) {
          this.gameState.players.player1.answer = null;
          this.gameState.players.player1.hasAnswered = false;
          this.gameState.players.player2.answer = null;
          this.gameState.players.player2.hasAnswered = false;
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showAnswerScreen' });
        }
        break;

      case 'endGame':
        if (playerKey) {
          this.gameState.players[playerKey].hasEnded = true;

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasEnded)) {
            this.broadcast({ type: 'showFinalScreen' });
          }
        }
        break;

      case 'restartGame':
        if (this.gameState) {
          this.gameState.currentQuestion = 0;
          this.gameState.history = [];
          this.gameState.players.player1.answer = null;
          this.gameState.players.player1.hasAnswered = false;
          this.gameState.players.player1.hasEnded = false;
          this.gameState.players.player1.hasClickedNext = false;
          this.gameState.players.player2.answer = null;
          this.gameState.players.player2.hasAnswered = false;
          this.gameState.players.player2.hasEnded = false;
          this.gameState.players.player2.hasClickedNext = false;
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showSetupScreen' });
        }
        break;
    }

    await this.state.storage.put("gameState", this.gameState);
    this.broadcast({ type: 'gameUpdate', payload: this.gameState }); // Send update after every action
  }

  sendToSocket(socket, message) {
    try {
      socket.send(JSON.stringify(message));
    } catch (err) {
      console.error("Failed to send message to a specific session:", err);
    }
  }

  broadcast(message) {
    const serializedMessage = JSON.stringify(message);
    for (const socketId in this.sessions) {
      try {
        this.sessions[socketId].send(serializedMessage);
      } catch (err) {
        console.error("Failed to send message to a session:", err);
      }
    }
  }
}

