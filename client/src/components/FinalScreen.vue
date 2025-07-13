
<template>
  <section id="final-screen">
    <h2>Игра завершена</h2>
    <h3>Результаты:</h3>
    <ul>
      <li v-for="(round, index) in history" :key="index" :class="getAnswerClass(round)" :style="getMixedBackground(round)">
        <p class="question-text">{{ questions[index] }}</p>
        <div class="answers-summary">
          <span>{{ player1Name }}: {{ translateAnswer(round.player1) }}</span>
          <span>{{ player2Name }}: {{ translateAnswer(round.player2) }}</span>
        </div>
      </li>
    </ul>
    <button @click="restart">Начать заново</button>
  </section>
</template>

<script>
export default {
  name: 'FinalScreen',
  props: {
    questions: Array,
    history: Array,
    player1Name: String,
    player2Name: String,
  },
  emits: ['restartGame'],
  setup(props, { emit }) {
    const restart = () => {
      emit('restartGame');
    };

    const getAnswerClass = (round) => {
      if (round.player1 === 'yes' && round.player2 === 'yes') {
        return 'yes-yes';
      } else if (round.player1 === 'no' && round.player2 === 'no') {
        return 'no-no';
      } else {
        return 'mixed';
      }
    };

    const translateAnswer = (answer) => {
      if (answer === 'yes') return 'ДА';
      if (answer === 'no') return 'НЕТ';
      return answer; // В случае других значений
    };

    const getMixedBackground = (round) => {
      if (round.player1 === 'yes' && round.player2 === 'no') {
        return { background: 'linear-gradient(to right, #e6ffe6 50%, #ffe6e6 50%)' };
      } else if (round.player1 === 'no' && round.player2 === 'yes') {
        return { background: 'linear-gradient(to right, #ffe6e6 50%, #e6ffe6 50%)' };
      }
      return {};
    };

    return {
      restart,
      getAnswerClass,
      translateAnswer,
      getMixedBackground,
    };
  },
};
</script>

<style lang="scss" scoped>
#final-screen {
  .question-text {
    font-weight: bold;
    margin-bottom: 5px;
  }

  .answers-summary {
    display: flex;
    justify-content: space-around;
    font-size: 0.9em;
    color: #555;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 8px;
    text-align: left;
  }

  .yes-yes {
    background-color: #e6ffe6; /* Светло-зеленый */
    border: 1px solid #66cc66;
  }

  .no-no {
    background-color: #ffe6e6; /* Светло-красный */
    border: 1px solid #cc6666;
  }

  .mixed {
    /* Динамический фон будет установлен через style-binding */
    border: 1px solid #999999;
  }
}
</style>
