<template>
  <div>
    <div v-if="gameId && screen !== 'setup'" class="game-code">Код игры: <strong>{{ gameId }}</strong></div>

    <SetupScreen 
      v-if="screen === 'setup'" 
      @create-game="createGame" 
      @join-game="joinGame" 
    />

    <AnswerScreen 
      v-if="screen === 'answer' && gameState" 
      :player1Name="player1?.name"
      :player2Name="player2?.name"
      :player1HasAnswered="player1?.hasAnswered"
      :player2HasAnswered="player2?.hasAnswered"
      :player1HasEnded="player1?.hasEnded"
      :player2HasEnded="player2?.hasEnded"
      :questionText="currentQuestion"
      :currentQuestionIndex="gameState.currentQuestion"
      :totalQuestions="gameState.questions.length"
      @answer="answer"
      @end-game="endGame"
    />

    <RevealScreen 
      v-if="screen === 'reveal' && gameState && revealedQuestionIndex !== null"
      :stats="stats"
      :questionText="gameState.questions[revealedQuestionIndex]"
      :player1Answer="gameState.history[revealedQuestionIndex]?.player1"
      :player2Answer="gameState.history[revealedQuestionIndex]?.player2"
      :player1Name="player1?.name"
      :player2Name="player2?.name"
      :player1HasClickedNext="player1?.hasClickedNext"
      :player2HasClickedNext="player2?.hasClickedNext"
      @restart-current-question="restartCurrentQuestion"
      @next-question="nextQuestion"
    />

    <FinalScreen 
      v-if="screen === 'final'" 
      :questions="gameState.questions"
      :history="gameState.history"
      :player1Name="player1?.name"
      :player2Name="player2?.name"
      @restart-game="restartGame" 
    />

    <div v-if="gameState && player2 === null && screen === 'setup'" class="waiting-room">
      <h2>Ожидание второго игрока...</h2>
      <p>Отправьте этот код другу:</p>
      <strong>{{ gameId }}</strong>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import socket from './socket';
import SetupScreen from './components/SetupScreen.vue';
import AnswerScreen from './components/AnswerScreen.vue';
import RevealScreen from './components/RevealScreen.vue';
import FinalScreen from './components/FinalScreen.vue';

export default {
  name: 'App',
  components: {
    SetupScreen,
    AnswerScreen,
    RevealScreen,
    FinalScreen,
  },
  setup() {
    const screen = ref('setup'); // setup, answer, reveal, final
    const gameId = ref(null);
    const gameState = ref(null);
    const revealedQuestionIndex = ref(null);

    const player1 = computed(() => {
      if (!gameState.value) return null;
      const playerIds = Object.keys(gameState.value.players);
      return gameState.value.players[playerIds[0]];
    });

    const player2 = computed(() => {
      if (!gameState.value || Object.keys(gameState.value.players).length < 2) return null;
      const playerIds = Object.keys(gameState.value.players);
      return gameState.value.players[playerIds[1]];
    });

    const currentQuestion = computed(() => {
        if (!gameState.value) return null;
        return gameState.value.questions[gameState.value.currentQuestion];
    });

    const stats = computed(() => {
        const newStats = { yesYes: 0, yesNo: 0, noNo: 0 };
        if (!gameState.value || !gameState.value.history) return newStats;

        for (const round of gameState.value.history) {
            if (!round) continue;
            if (round.player1 === 'yes' && round.player2 === 'yes') {
                newStats.yesYes++;
            } else if (round.player1 === 'no' && round.player2 === 'no') {
                newStats.noNo++;
            } else {
                newStats.yesNo++;
            }
        }
        return newStats;
    });

    const createGame = (player1Name) => {
      socket.emit('createGame', player1Name);
    };

    const joinGame = ({ gameId: id, player2Name }) => {
      gameId.value = id; // Устанавливаем gameId для присоединяющегося игрока
      socket.emit('joinGame', { gameId: id, player2Name });
    };

    const answer = (choice) => {
      socket.emit('answer', { gameId: gameId.value, answer: choice });
    };

    const nextQuestion = () => {
      socket.emit('nextQuestion', gameId.value);
    };

    const prevQuestion = () => {
      socket.emit('prevQuestion', gameId.value);
    };

    const restartCurrentQuestion = () => {
      socket.emit('restartCurrentQuestion', gameId.value);
    };

    const endGame = () => {
      socket.emit('endGame', gameId.value);
    };

    const restartGame = () => {
      socket.emit('restartGame', gameId.value);
    };

    onMounted(() => {
      socket.on('gameCreated', (id) => {
        gameId.value = id;
        // Ждем второго игрока
      });

      socket.on('gameUpdate', (state) => {
        gameState.value = state;
        // Если второй игрок присоединился, переходим на экран ответа
        if (Object.keys(state.players).length === 2 && screen.value === 'setup') {
            screen.value = 'answer';
        }
      });

      socket.on('showReveal', ({ questionIndex }) => {
        revealedQuestionIndex.value = questionIndex;
        screen.value = 'reveal';
      });

      socket.on('showAnswerScreen', () => {
        screen.value = 'answer';
      });

      socket.on('showFinalScreen', () => {
        screen.value = 'final';
      });

      socket.on('showSetupScreen', () => {
        screen.value = 'setup';
        gameId.value = null;
        gameState.value = null;
      });

      socket.on('gameError', (message) => {
        alert(message);
      });
    });

    return {
      screen,
      gameId,
      gameState,
      player1,
      player2,
      currentQuestion,
      stats,
      revealedQuestionIndex,
      createGame,
      joinGame,
      answer,
      nextQuestion,
      restartCurrentQuestion,
      endGame,
      restartGame,
    };
  },
};
</script>

<style lang="scss">
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f0f2f5;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

#app {
  width: 100%;
  max-width: 480px;
  margin: 20px;
  padding: 30px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  text-align: center;
}

h1 {
  color: #333;
}

.game-code {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #e9ecef;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
}

.waiting-room {
  margin-top: 20px;
  padding: 20px;
  background-color: #e9ecef;
  border-radius: 8px;
  strong {
    font-size: 1.5em;
    color: #007bff;
  }
}

strong {
  color: #007bff;
  font-family: monospace;
  font-size: 1.2em;
}

.tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #dee2e6;

  button {
    padding: 10px 20px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    color: #6c757d;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    margin-top: 0;

    &.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }
  }
}

form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: 14px;
  color: #495057;
  width: 100%;
}

input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

button {
  padding: 12px 20px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 10px;

  &:hover {
    background-color: #0056b3;
  }
}

.player-names {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  font-weight: bold;
  color: #495057;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.question {
  margin: 30px 0;
  font-size: 20px;
  line-height: 1.5;
  color: #343a40;
  word-wrap: break-word; /* Перенос длинных слов */
}

.answers {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;

  button {
    font-size: 18px;
    padding: 15px 30px;
    min-width: 120px;
  }
}

.answers-reveal {
    margin: 20px 0;
    display: flex;
    justify-content: space-around;
    font-size: 18px;
    font-weight: bold;
}

.navigation {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    font-size: 16px;
}
</style>