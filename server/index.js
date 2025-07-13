import { GameRoom } from './durable-object.js';
import questions from './questions.json';

export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let path = url.pathname.slice(1).split('/');
    let gameId = path[0];

    if (url.pathname === '/api/create-game' && request.method === 'POST') {
        // Создаем новый Durable Object для новой игры
        let id = env.GAME_ROOM.newUniqueId();
        let newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await env.GAME_IDS.put(newGameId, id.toString());
        return new Response(JSON.stringify({ gameId: newGameId, durableObjectId: id.toString() }), { headers: { 'Content-Type': 'application/json' } });
    } else if (gameId) {
        // Получаем существующий Durable Object по gameId
        let durableObjectId = await env.GAME_IDS.get(gameId);
        if (durableObjectId) {
            let id = env.GAME_ROOM.idFromString(durableObjectId);
            let stub = env.GAME_ROOM.get(id);
            return stub.fetch(request);
        } else {
            return new Response("Game not found", { status: 404 });
        }
    }

    return new Response("Not found", { status: 404 });
  },
};

export { GameRoom };
