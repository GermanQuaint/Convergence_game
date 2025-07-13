const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Временно разрешаем все источники для разработки
  }
});

// Serve static files from the Vue app build output
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle SPA routing
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

const games = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Создание новой игры
  socket.on('createGame', (player1Name) => {
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    games[gameId] = {
      players: { [socket.id]: { name: player1Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false } },
      questions: require('./questions.json').sort(() => Math.random() - 0.5), // Загружаем и перемешиваем вопросы
      currentQuestion: 0,
    };
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
    socket.emit('gameUpdate', games[gameId]);
    console.log(`Game created with ID: ${gameId} by ${player1Name}`);
  });

  // Присоединение к игре
  socket.on('joinGame', ({ gameId, player2Name }) => {
    if (games[gameId] && Object.keys(games[gameId].players).length < 2) {
      const existingPlayerNames = Object.values(games[gameId].players).map(p => p.name);
      if (existingPlayerNames.includes(player2Name)) {
        socket.emit('gameError', 'Это имя уже занято в данной игре. Пожалуйста, выберите другое имя.');
        return;
      }
      games[gameId].players[socket.id] = { name: player2Name, answer: null, hasAnswered: false, hasEnded: false, hasClickedNext: false };
      socket.join(gameId);
      io.to(gameId).emit('gameUpdate', games[gameId]);
      console.log(`${player2Name} joined game ${gameId}`);
    } else {
      socket.emit('gameError', 'Игра не найдена или уже заполнена');
    }
  });

  // Обработка ответа
  socket.on('answer', ({ gameId, answer }) => {
    console.log(`Answer received from ${socket.id} for game ${gameId}: ${answer}`);
    const game = games[gameId];
    if (game && game.players[socket.id]) {
      game.players[socket.id].answer = answer;
      game.players[socket.id].hasAnswered = true; // Устанавливаем, что игрок ответил
      console.log(`Player ${socket.id} answer set to: ${game.players[socket.id].answer}`);

      const players = Object.values(game.players);
      console.log('Current players answers:', players.map(p => p.answer));

      // Уведомляем всех об ответе одного игрока
      io.to(gameId).emit('gameUpdate', game);

      // Проверяем, ответили ли оба
      if (players.length === 2 && players.every(p => p.answer !== null)) {
        console.log(`Both players in game ${gameId} have answered.`);
        // Сохраняем ответы для текущего вопроса
        if (!game.history) {
          game.history = [];
        }
        game.history[game.currentQuestion] = {
          player1: players[0].answer,
          player2: players[1].answer,
        };

        // Сбрасываем ответы для следующего раунда
        players.forEach(p => p.answer = null);

        // Отправляем обновленное состояние игры с историей
        io.to(gameId).emit('gameUpdate', game);

        // Отправляем сигнал для перехода на экран результатов
        setTimeout(() => {
          io.to(gameId).emit('showReveal', { questionIndex: game.currentQuestion });
        }, 1000);
      } else {
        console.log(`Waiting for other player(s) to answer in game ${gameId}.`);
      }
    } else {
      console.log(`Game ${gameId} not found or player ${socket.id} not in game.`);
    }
  });

  socket.on('nextQuestion', (gameId) => {
    const game = games[gameId];
    if (game && game.players[socket.id]) {
      game.players[socket.id].hasClickedNext = true;
      io.to(gameId).emit('gameUpdate', game);

      const players = Object.values(game.players);
      if (players.length === 2 && players.every(p => p.hasClickedNext)) {
        if (game.currentQuestion < game.questions.length - 1) {
          game.currentQuestion++;
          Object.values(game.players).forEach(p => {
            p.hasAnswered = false;
            p.hasClickedNext = false; // Сбрасываем статус для следующего вопроса
          });
          io.to(gameId).emit('gameUpdate', game);
          io.to(gameId).emit('showAnswerScreen');
        }
      }
    }
  });

  socket.on('prevQuestion', (gameId) => {
    const game = games[gameId];
    if (game && game.currentQuestion > 0) {
      game.currentQuestion--;
      io.to(gameId).emit('gameUpdate', game);
      io.to(gameId).emit('showReveal', { questionIndex: game.currentQuestion });
    }
  });

  socket.on('restartCurrentQuestion', (gameId) => {
    const game = games[gameId];
    if (game) {
      Object.values(game.players).forEach(p => {
        p.answer = null;
        p.hasAnswered = false;
      });
      io.to(gameId).emit('gameUpdate', game);
      io.to(gameId).emit('showAnswerScreen');
    }
  });

  socket.on('endGame', (gameId) => {
    const game = games[gameId];
    if (game && game.players[socket.id]) {
      game.players[socket.id].hasEnded = true;
      io.to(gameId).emit('gameUpdate', game);

      const players = Object.values(game.players);
      if (players.length === 2 && players.every(p => p.hasEnded)) {
        io.to(gameId).emit('showFinalScreen');
      }
    }
  });

  socket.on('restartGame', (gameId) => {
    // Сбрасываем состояние игры, но сохраняем игроков
    const game = games[gameId];
    if (game) {
      game.currentQuestion = 0;
      game.history = [];
      Object.values(game.players).forEach(p => {
        p.answer = null;
        p.hasAnswered = false; // Сбрасываем статус ответа
        p.hasEnded = false; // Сбрасываем статус завершения игры
        p.hasClickedNext = false; // Сбрасываем статус для следующего вопроса
      });
      io.to(gameId).emit('gameUpdate', game);
      io.to(gameId).emit('showSetupScreen'); // Возвращаем на экран настройки
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // TODO: обработать отключение игрока
  });
});

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});