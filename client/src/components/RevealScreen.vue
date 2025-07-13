
<template>
  <section id="reveal-screen">
    <div class="stats">
      <div>ДА/ДА: <span>{{ stats.yesYes }}</span></div>
      <div>ДА/НЕТ: <span>{{ stats.yesNo }}</span></div>
      <div>НЕТ/НЕТ: <span>{{ stats.noNo }}</span></div>
    </div>
    <div class="question">
      <p>{{ questionText }}</p>
    </div>
    <div class="answers-reveal">
      <span>{{ player1Name }}: {{ translateAnswer(player1Answer) }}</span>
      <span>{{ player2Name }}: {{ translateAnswer(player2Answer) }}</span>
    </div>
    <div class="navigation">
      <button @click="restartCurrent">⟳</button>
      <div class="next-status">
        <p v-if="player1HasClickedNext && !player2HasClickedNext">Ожидание {{ player2Name }}...</p>
        <p v-if="player2HasClickedNext && !player1HasClickedNext">Ожидание {{ player1Name }}...</p>
        <p v-if="player1HasClickedNext && player2HasClickedNext">Оба игрока готовы!</p>
      </div>
      <button @click="next">→</button>
    </div>
  </section>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'RevealScreen',
  props: {
    stats: Object,
    questionText: String,
    player1Answer: String,
    player2Answer: String,
    player1Name: String,
    player2Name: String,
    player1HasClickedNext: Boolean,
    player2HasClickedNext: Boolean,
  },
  emits: ['restartCurrentQuestion', 'nextQuestion'],
  setup(props, { emit }) {
    const restartCurrent = () => {
      emit('restartCurrentQuestion');
    };

    const next = () => {
      emit('nextQuestion');
    };

    const translateAnswer = (answer) => {
      if (answer === 'yes') return 'ДА';
      if (answer === 'no') return 'НЕТ';
      return answer; // В случае других значений
    };

    return {
      restartCurrent,
      next,
      translateAnswer,
    };
  },
};
</script>

<style lang="scss" scoped>
.navigation {
  display: flex;
  justify-content: space-between;
  align-items: center; /* Выравниваем элементы по центру по вертикали */
  margin-top: 20px;

  .next-status {
    flex-grow: 1; /* Позволяем блоку занимать все доступное пространство */
    text-align: center;
    font-size: 0.9em;
    color: #555;
    margin: 0 10px; /* Добавляем отступы по бокам */
  }

  button {
    /* Стили для кнопок */
  }
}

/* Остальные стили для экрана результатов */
</style>
