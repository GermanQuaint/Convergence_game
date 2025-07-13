export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = {}; // Use an object to store sessions by their unique ID

    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("gameState");
      this.gameState = stored || {
        players: {}, // Will store player1 and player2
        questions: [], // Initialize as empty, will fetch from KV
        currentQuestion: 0,
        history: [],
        gameId: null, // Will store the short, human-readable game ID
      };
      console.log(`[DO ${this.state.id}] Initialized with state:`, this.gameState);

      // Fetch questions from KV
      try {
        console.log(`[DO ${this.state.id}] Attempting to fetch questions from QUESTIONS_KV.`);
        const questionsJson = await this.env.QUESTIONS_KV.get('all_questions');
        console.log(`[DO ${this.state.id}] questionsJson from KV:`, questionsJson ? questionsJson.substring(0, 100) + '...' : questionsJson);
        if (questionsJson) {
          this.gameState.questions = JSON.parse(questionsJson).sort(() => Math.random() - 0.5);
          console.log(`[DO ${this.state.id}] Questions loaded from KV. Total questions: ${this.gameState.questions.length}`);
        } else {
          console.error(`[DO ${this.state.id}] No questions found in QUESTIONS_KV for key 'all_questions'.`);
        }
      } catch (e) {
        console.error(`[DO ${this.state.id}] Error loading questions from KV:`, e);
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    console.log(`[DO ${this.state.id}] Fetch request: ${request.method} ${url.pathname}`);

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
    console.log(`[DO ${this.state.id}] WebSocket connected: ${socketId}. Total sessions: ${Object.keys(this.sessions).length}`);

    // Send initial game state to the newly connected client
    this.sendToSocket(webSocket, { type: 'gameUpdate', payload: this.gameState });

    webSocket.addEventListener("message", async msg => {
      console.log(`[DO ${this.state.id}] Message from ${socketId}:`, msg.data);
      try {
        const message = JSON.parse(msg.data);
        await this.handleMessage(message, socketId); // Pass socketId to identify the sender
      } catch (err) {
        console.error(`[DO ${this.state.id}] Error parsing message from ${socketId}:`, err);
        this.sendToSocket(webSocket, { type: "gameError", payload: "Invalid message format" });
      }
    });

    webSocket.addEventListener("close", async () => {
      console.log(`[DO ${this.state.id}] WebSocket disconnected: ${socketId}`);
      delete this.sessions[socketId];
      // Remove player's socketId association on disconnect
      for (const playerKey in this.gameState.players) {
        if (this.gameState.players[playerKey] && this.gameState.players[playerKey].socketId === socketId) {
          this.gameState.players[playerKey].socketId = null; // Mark as disconnected
          console.log(`[DO ${this.state.id}] Player ${playerKey} disconnected.`);
          break;
        }
      }
      await this.state.storage.put("gameState", this.gameState);
      this.broadcast({ type: 'gameUpdate', payload: this.gameState });
    });

    webSocket.addEventListener("error", (err) => {
        console.error(`[DO ${this.state.id}] WebSocket error for ${socketId}:`, err);
    });
  }

  async handleMessage(message, socketId) {
    const { type, payload } = message;
    console.log(`[DO ${this.state.id}] Handling message type: ${type} from ${socketId}`);

    let playerKey = null; // 'player1' or 'player2'
    // Find which player this socketId belongs to
    for (const key in this.gameState.players) {
      if (this.gameState.players[key] && this.gameState.players[key].socketId === socketId) {
        playerKey = key;
        break;
      }
    }
    console.log(`[DO ${this.state.id}] Player key for ${socketId}: ${playerKey}`);

    switch (type) {
      case 'createGame':
        if (Object.keys(this.gameState.players).length === 0) {
          this.gameState.players.player1 = { name: payload.player1Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false, socketId: socketId };
          this.gameState.gameId = payload.gameId; // Set the short gameId from the client
          console.log(`[DO ${this.state.id}] Game created by player1: ${payload.player1Name}. Game ID: ${this.gameState.gameId}`);
          this.broadcast({ type: 'gameCreated', payload: this.gameState.gameId });
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        } else {
          console.log(`[DO ${this.state.id}] Attempt to create game when already created.`);
          this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Игра уже создана.' });
        }
        break;

      case 'joinGame':
        if (Object.keys(this.gameState.players).length === 1 && !this.gameState.players.player2) {
          const existingPlayerNames = Object.values(this.gameState.players).map(p => p.name);
          if (existingPlayerNames.includes(payload.player2Name)) {
            console.log(`[DO ${this.state.id}] Player name ${payload.player2Name} already taken.`);
            this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Это имя уже занято в данной игре. Пожалуйста, выберите другое имя.' });
            return;
          }
          this.gameState.players.player2 = { name: payload.player2Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false, socketId: socketId };
          console.log(`[DO ${this.state.id}] Player2 ${payload.player2Name} joined game.`);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        } else {
          console.log(`[DO ${this.state.id}] Attempt to join game that is full or not found.`);
          this.sendToSocket(this.sessions[socketId], { type: 'gameError', payload: 'Игра не найдена или уже заполнена' });
        }
        break;

      case 'answer':
        if (playerKey) {
          this.gameState.players[playerKey].answer = payload.answer;
          this.gameState.players[playerKey].hasAnswered = true;
          console.log(`[DO ${this.state.id}] Player ${playerKey} answered: ${payload.answer}`);

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasAnswered)) {
            console.log(`[DO ${this.state.id}] Both players answered.`);
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
          console.log(`[DO ${this.state.id}] Player ${playerKey} clicked next.`);

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasClickedNext)) {
            console.log(`[DO ${this.state.id}] Both players clicked next.`);
            // Reset hasClickedNext for both players immediately after both have clicked
            this.gameState.players.player1.hasClickedNext = false;
            this.gameState.players.player2.hasClickedNext = false;

            if (this.gameState.currentQuestion === this.gameState.questions.length - 1) {
              // All questions answered, show final screen
              this.broadcast({ type: 'showFinalScreen' });
            } else {
              // Not the last question, move to the next
              this.gameState.currentQuestion++;
              this.gameState.players.player1.hasAnswered = false;
              this.gameState.players.player2.hasAnswered = false;

              this.broadcast({ type: 'gameUpdate', payload: this.gameState });
              this.broadcast({ type: 'showAnswerScreen' });
            }
          }
        }
        break;

      case 'prevQuestion':
        if (this.gameState.currentQuestion > 0) {
          this.gameState.currentQuestion--;
          console.log(`[DO ${this.state.id}] Previous question. Current: ${this.gameState.currentQuestion}`);
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
          console.log(`[DO ${this.state.id}] Restarting current question.`);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showAnswerScreen' });
        }
        break;

      case 'endGame':
        if (playerKey) {
          this.gameState.players[playerKey].hasEnded = true;
          console.log(`[DO ${this.state.id}] Player ${playerKey} ended game.`);

          const playersArray = Object.values(this.gameState.players);
          if (playersArray.length === 2 && playersArray.every(p => p.hasEnded)) {
            console.log(`[DO ${this.state.id}] Both players ended game.`);
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
          console.log(`[DO ${this.state.id}] Restarting game.`);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showSetupScreen' });
        }
        break;
    }

    await this.state.storage.put("gameState", this.gameState);
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