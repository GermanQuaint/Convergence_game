export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.gameId = this.state.id.toString(); // ID Durable Object - это ID игры
    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("gameState");
      this.gameState = stored || {};
      if (!this.gameState.players) {
        this.gameState.players = {};
      }
      if (!this.gameState.questions) {
        this.gameState.questions = JSON.parse(this.env.QUESTIONS);
      }
      if (this.gameState.currentQuestion === undefined) {
        this.gameState.currentQuestion = 0;
      }
      if (!this.gameState.history) {
        this.gameState.history = [];
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      await this.handleSession(server, url.pathname.substring(1)); // Передаем gameId из URL
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected websocket upgrade", { status: 426 });
  }

  async handleSession(webSocket, gameIdFromUrl) {
    webSocket.accept();
    webSocket.id = Math.random().toString(36).substring(2, 10); // Присваиваем уникальный ID WebSocket
    this.sessions.push(webSocket);

    // Если это первое подключение к новой игре, инициализируем ее
    if (Object.keys(this.gameState.players).length === 0 && gameIdFromUrl === 'new-game') {
        this.gameState.gameId = this.gameId; // Устанавливаем gameId для состояния игры
        this.gameState.questions = JSON.parse(this.env.QUESTIONS).sort(() => Math.random() - 0.5);
        this.gameState.currentQuestion = 0;
        this.gameState.history = [];
        this.broadcast({ type: 'gameCreated', payload: this.gameId });
    }

    // Отправляем текущее состояние игры новому подключившемуся клиенту
    this.broadcast({ type: 'gameUpdate', payload: this.gameState });

    webSocket.addEventListener("message", async msg => {
      try {
        const message = JSON.parse(msg.data);
        await this.handleMessage(message, webSocket);
      } catch (err) {
        webSocket.send(JSON.stringify({ type: "gameError", payload: "Invalid message format" }));
      }
    });

    webSocket.addEventListener("close", async () => {
      this.sessions = this.sessions.filter(session => session !== webSocket);
      // Удаляем игрока из состояния игры при отключении
      if (this.gameState.players[webSocket.id]) {
        delete this.gameState.players[webSocket.id];
        await this.state.storage.put("gameState", this.gameState);
        this.broadcast({ type: 'gameUpdate', payload: this.gameState });
      }
    });

    webSocket.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });
  }

  async handleMessage(message, webSocket) {
    const { type, payload } = message;

    switch (type) {
      case 'createGame':
        // Эта логика теперь обрабатывается в handleSession для нового подключения
        // Если сообщение createGame приходит сюда, это может быть повторное сообщение
        // или попытка создать игру в уже существующем DO. Игнорируем или обрабатываем как ошибку.
        if (Object.keys(this.gameState.players).length === 0) {
            this.gameState.players[webSocket.id] = { name: payload.player1Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false };
            await this.state.storage.put("gameState", this.gameState);
            this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        } else {
            webSocket.send(JSON.stringify({ type: 'gameError', payload: 'Игра уже создана.' }));
        }
        break;

      case 'joinGame':
        if (Object.keys(this.gameState.players).length < 2) {
          const existingPlayerNames = Object.values(this.gameState.players).map(p => p.name);
          if (existingPlayerNames.includes(payload.player2Name)) {
            webSocket.send(JSON.stringify({ type: 'gameError', payload: 'Это имя уже занято в данной игре. Пожалуйста, выберите другое имя.' }));
            return;
          }
          this.gameState.players[webSocket.id] = { name: payload.player2Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false };
          await this.state.storage.put("gameState", this.gameState);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
        } else {
          webSocket.send(JSON.stringify({ type: 'gameError', payload: 'Игра уже заполнена' }));
        }
        break;

      case 'answer':
        if (this.gameState.players[webSocket.id]) {
          this.gameState.players[webSocket.id].answer = payload.answer;
          this.gameState.players[webSocket.id].hasAnswered = true;
          await this.state.storage.put("gameState", this.gameState);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });

          const players = Object.values(this.gameState.players);
          if (players.length === 2 && players.every(p => p.hasAnswered)) {
            this.gameState.history[this.gameState.currentQuestion] = {
              player1: players[0].answer,
              player2: players[1].answer,
            };
            players.forEach(p => p.answer = null);
            await this.state.storage.put("gameState", this.gameState);
            this.broadcast({ type: 'gameUpdate', payload: this.gameState });
            // Задержка для показа ответов, затем переход к следующему экрану
            setTimeout(() => {
              this.broadcast({ type: 'showReveal', payload: { questionIndex: this.gameState.currentQuestion } });
            }, 1000);
          }
        }
        break;

      case 'nextQuestion':
        if (this.gameState.players[webSocket.id]) {
          this.gameState.players[webSocket.id].hasClickedNext = true;
          await this.state.storage.put("gameState", this.gameState);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });

          const players = Object.values(this.gameState.players);
          if (players.length === 2 && players.every(p => p.hasClickedNext)) {
            if (this.gameState.currentQuestion < this.gameState.questions.length - 1) {
              this.gameState.currentQuestion++;
              Object.values(this.gameState.players).forEach(p => {
                p.hasAnswered = false;
                p.hasClickedNext = false;
              });
              await this.state.storage.put("gameState", this.gameState);
              this.broadcast({ type: 'gameUpdate', payload: this.gameState });
              this.broadcast({ type: 'showAnswerScreen' });
            }
          }
        }
        break;

      case 'prevQuestion':
        if (this.gameState.currentQuestion > 0) {
          this.gameState.currentQuestion--;
          await this.state.storage.put("gameState", this.gameState);
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
          await this.state.storage.put("gameState", this.gameState);
          this.broadcast({ type: 'gameUpdate', payload: this.gameState });
          this.broadcast({ type: 'showAnswerScreen' });
        }
        break;

      case 'endGame':
        if (this.gameState.players[webSocket.id]) {
          this.gameState.players[webSocket.id].hasEnded = true;
          await this.state.storage.put("gameState", this.gameState);
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
          await this.state.storage.put("gameState", this.gameState);
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
