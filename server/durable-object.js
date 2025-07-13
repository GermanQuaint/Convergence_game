export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("gameState");
      this.gameState = stored || {};
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    } else if (path.startsWith("/api/")) {
        // Handle API requests here if needed in the future
    }

    return new Response("Not found", { status: 404 });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    this.sessions.push(webSocket);

    webSocket.addEventListener("message", async msg => {
      try {
        const message = JSON.parse(msg.data);
        await this.handleMessage(message, webSocket);
      } catch (err) {
        webSocket.send(JSON.stringify({ error: "Invalid message format" }));
      }
    });

    webSocket.addEventListener("close", () => {
      this.sessions = this.sessions.filter(session => session !== webSocket);
      // Handle player disconnect
    });

    webSocket.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });
  }

  async handleMessage(message, webSocket) {
    const { type, payload } = message;
    const gameId = this.gameState.gameId;

    switch (type) {
      case 'createGame':
        this.gameState.gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.gameState.players = { [webSocket.id]: { name: payload.player1Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false } };
        this.gameState.questions = JSON.parse(await this.env.QUESTIONS).sort(() => Math.random() - 0.5);
        this.gameState.currentQuestion = 0;
        this.broadcast({ type: 'gameCreated', payload: this.gameState.gameId });
        this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        break;

      case 'joinGame':
        if (this.gameState.players && Object.keys(this.gameState.players).length < 2) {
          const existingPlayerNames = Object.values(this.gameState.players).map(p => p.name);
          if (existingPlayerNames.includes(payload.player2Name)) {
            webSocket.send(JSON.stringify({ type: 'gameError', payload: 'Это имя уже занято в данной игре. Пожалуйста, выберите другое имя.' }));
            return;
          }
          this.gameState.players[webSocket.id] = { name: payload.player2Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false };
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        } else {
          webSocket.send(JSON.stringify({ type: 'gameError', payload: 'Игра не найдена или уже заполнена' }));
        }
        break;

      case 'answer':
        if (this.gameState.players && this.gameState.players[webSocket.id]) {
          this.gameState.players[webSocket.id].answer = payload.answer;
          this.gameState.players[webSocket.id].hasAnswered = true;
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });

          const players = Object.values(this.gameState.players);
          if (players.length === 2 && players.every(p => p.answer !== null)) {
            if (!this.gameState.history) {
              this.gameState.history = [];
            }
            this.gameState.history[this.gameState.currentQuestion] = {
              player1: players[0].answer,
              player2: players[1].answer,
            };
            players.forEach(p => p.answer = null);
            this.broadcast({ type: 'gameUpdate', payload: this.gameState });
            setTimeout(() => {
              this.broadcast({ type: 'showReveal', payload: { questionIndex: this.gameState.currentQuestion } });
            }, 1000);
          }
        }
        break;

      case 'nextQuestion':
        if (this.gameState.players && this.gameState.players[webSocket.id]) {
          this.gameState.players[webSocket.id].hasClickedNext = true;
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });

          const players = Object.values(this.gameState.players);
          if (players.length === 2 && players.every(p => p.hasClickedNext)) {
            if (this.gameState.currentQuestion < this.gameState.questions.length - 1) {
              this.gameState.currentQuestion++;
              Object.values(this.gameState.players).forEach(p => {
                p.hasAnswered = false;
                p.hasClickedNext = false;
              });
              this.broadcast({ type: 'gameUpdate', payload: this.gameState });
              this.broadcast({ type: 'showAnswerScreen' });
            }
          }
        }
        break;

        case 'prevQuestion':
            if (this.gameState && this.gameState.currentQuestion > 0) {
                this.gameState.currentQuestion--;
                this.broadcast({ type: 'gameUpdate', payload: this.gameState });
                this.broadcast({ type: 'showReveal', payload: { questionIndex: this.gameState.currentQuestion } });
            }
            break;

        case 'restartCurrentQuestion':
            if (this.gameState) {
                Object.values(this.gameState.players).forEach(p => {
                    p.answer = null;
                    p.hasAnswered = false;
                });
                this.broadcast({ type: 'gameUpdate', payload: this.gameState });
                this.broadcast({ type: 'showAnswerScreen' });
            }
            break;

        case 'endGame':
            if (this.gameState && this.gameState.players[webSocket.id]) {
                this.gameState.players[webSocket.id].hasEnded = true;
                this.broadcast({ type: 'gameUpdate', payload: this.gameState });

                const players = Object.values(this.gameState.players);
                if (players.length === 2 && players.every(p => p.hasEnded)) {
                    this.broadcast({ type: 'showFinalScreen' });
                }
            }
            break;

        case 'restartGame':
            if (this.gameState) {
                this.gameState.currentQuestion = 0;
                this.gameState.history = [];
                Object.values(this.gameState.players).forEach(p => {
                    p.answer = null;
                    p.hasAnswered = false;
                    p.hasEnded = false;
                    p.hasClickedNext = false;
                });
                this.broadcast({ type: 'gameUpdate', payload: this.gameState });
                this.broadcast({ type: 'showSetupScreen' });
            }
            break;
    }

    await this.state.storage.put("gameState", this.gameState);
  }

  broadcast(message) {
    const serializedMessage = JSON.stringify(message);
    this.sessions.forEach(session => {
      try {
        session.send(serializedMessage);
      } catch (err) {
        console.error("Failed to send message to a session:", err);
      }
    });
  }
}
