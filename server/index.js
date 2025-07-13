import { GameRoom } from './durable-object.js';

export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let gameId = url.pathname.slice(1).split('/')[0];

    if (!gameId) {
        // If no gameId is present in the URL, you might want to handle it.
        // For example, by creating a new game or returning an error.
        // For now, let's generate a new gameId for demonstration.
        gameId = env.GAME_ROOM.newUniqueId().toString();
    }

    let id = env.GAME_ROOM.idFromName(gameId);
    let stub = env.GAME_ROOM.get(id);

    return stub.fetch(request);
  },
};

export { GameRoom };
