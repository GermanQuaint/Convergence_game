
<template>
  <section id="setup-screen">
    <h1>Настройка игроков</h1>
    
    <div class="tabs">
      <button :class="{ active: mode === 'create' }" @click="mode = 'create'">Создать игру</button>
      <button :class="{ active: mode === 'join' }" @click="mode = 'join'">Присоединиться</button>
    </div>

    <!-- Форма создания игры -->
    <form v-if="mode === 'create'" @submit.prevent="createGame">
      <label>Ваше имя: <input type="text" v-model="player1Name" maxlength="16" required></label>
      <button type="submit">Создать</button>
    </form>

    <!-- Форма присоединения к игре -->
    <form v-if="mode === 'join'" @submit.prevent="joinGame">
      <label>Код игры: <input type="text" v-model="gameId" required></label>
      <label>Ваше имя: <input type="text" v-model="player2Name" maxlength="16" required></label>
      <button type="submit">Присоединиться</button>
    </form>

  </section>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'SetupScreen',
  emits: ['createGame', 'joinGame'],
  setup(props, { emit }) {
    const mode = ref('create'); // 'create' or 'join'
    const player1Name = ref('');
    const player2Name = ref('');
    const gameId = ref('');

    const createGame = () => {
      emit('createGame', player1Name.value);
    };

    const joinGame = () => {
      emit('joinGame', { gameId: gameId.value.toUpperCase(), player2Name: player2Name.value });
    };

    return {
      mode,
      player1Name,
      player2Name,
      gameId,
      createGame,
      joinGame,
    };
  },
};
</script>

<style lang="scss" scoped>
/* Стили для экрана настройки */
</style>
