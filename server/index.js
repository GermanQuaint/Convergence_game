export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let path = url.pathname.slice(1).split('/');
    let gameId = path[0];

    if (gameId === 'new-game') {
        // Создаем новый Durable Object для новой игры
        let id = env.GAME_ROOM.newUniqueId();
        let stub = env.GAME_ROOM.get(id);
        return stub.fetch(request);
    } else if (gameId) {
        // Получаем существующий Durable Object по gameId
        let id = env.GAME_ROOM.idFromName(gameId);
        let stub = env.GAME_ROOM.get(id);
        return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

export { GameRoom } from './durable-object.js';
