import { GameRoom } from './durable-object.js';


export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let path = url.pathname.slice(1).split('/');
    let gameId = path[0];

    console.log(`[Worker] Request received: ${request.method} ${url.pathname}`);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (url.pathname === '/api/create-game' && request.method === 'POST') {
        console.log('[Worker] Handling /api/create-game POST request');
        // Создаем новый Durable Object для новой игры
        let id = env.GAME_ROOM.newUniqueId();
        let newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await env.GAME_IDS.put(newGameId, id.toString());
        console.log(`[Worker] Created new game: ${newGameId} with DO ID: ${id.toString()}`);
        return new Response(JSON.stringify({ gameId: newGameId, durableObjectId: id.toString() }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } else if (gameId) {
        console.log(`[Worker] Handling request for gameId: ${gameId}`);
        // Получаем существующий Durable Object по gameId
        let durableObjectId = await env.GAME_IDS.get(gameId);
        if (durableObjectId) {
            console.log(`[Worker] Found DO ID: ${durableObjectId} for gameId: ${gameId}`);
            let id = env.GAME_ROOM.idFromString(durableObjectId);
            let stub = env.GAME_ROOM.get(id);
            const response = await stub.fetch(request);
            // Add CORS headers to WebSocket upgrade response as well
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
        } else {
            console.log(`[Worker] Game not found for gameId: ${gameId}`);
            return new Response("Game not found", { status: 404 });
        }
    }

    console.log('[Worker] Not found');
    return new Response("Not found", { status: 404 });
  },
};

export { GameRoom };