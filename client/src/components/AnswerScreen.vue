
<template>
  <section id="answer-screen">
    <div class="question-counter">Вопрос {{ currentQuestionIndex + 1 }}</div>
    <div class="player-names">
      <span>{{ player1Name }} <span v-if="player1HasAnswered" class="checkmark">✓</span></span>
      <span>{{ player2Name }} <span v-if="player2HasAnswered" class="checkmark">✓</span></span>
    </div>
    <div class="question">
      <p>{{ questionText }}</p>
    </div>
    <div class="answers">
      <button @click="sendAnswer('yes')">ДА</button>
      <button @click="sendAnswer('no')">НЕТ</button>
    </div>
    <button @click="endGame">Хватит вопросов</button>
    <div class="end-game-status">
      <p v-if="player1HasEnded && !player2HasEnded">Ожидание {{ player2Name }}...</p>
      <p v-if="player2HasEnded && !player1HasEnded">Ожидание {{ player1Name }}...</p>
      <p v-if="player1HasEnded && player2HasEnded">Оба игрока готовы завершить игру!</p>
    </div>
  </section>
</template>

<script>
export default {
  name: 'AnswerScreen',
  props: {
    player1Name: String,
    player2Name: String,
    player1HasAnswered: Boolean,
    player2HasAnswered: Boolean,
    player1HasEnded: Boolean,
    player2HasEnded: Boolean,
    questionText: String,
    currentQuestionIndex: Number,
    totalQuestions: Number,
  },
  emits: ['answer', 'endGame'],
  setup(props, { emit }) {
    const sendAnswer = (choice) => {
      emit('answer', choice);
    };

    const endGame = () => {
      emit('endGame');
    };

    return {
      sendAnswer,
      endGame,
    };
  },
};
</script>

<style lang="scss" scoped>
.player-names {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  font-weight: bold;
  color: #495057;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;

  span {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .checkmark {
    color: green;
    font-size: 1.2em;
  }
}

.question-counter {
  font-size: 1.1em;
  margin-bottom: 15px;
  color: #555;
}

.end-game-status {
  margin-top: 10px;
  font-size: 0.9em;
  color: #555;
}

/* Остальные стили для экрана ответа */
</style>
