
const workerUrl = 'https://convergence-game-server.hermanquaintit.workers.dev';

let socket;

function connectWebSocket(gameId) {
  const url = new URL(workerUrl);
  url.pathname = `/${gameId}`;
  url.protocol = 'wss';

  socket = new WebSocket(url.toString());

  socket.addEventListener('open', () => {
    console.log('WebSocket connection established');
  });

  socket.addEventListener('close', event => {
    console.log('WebSocket connection closed', event);
  });

  socket.addEventListener('error', event => {
    console.error('WebSocket error', event);
  });

  return socket;
}

function getSocket() {
    if (!socket) {
        throw new Error("WebSocket is not connected. Call connectWebSocket first.");
    }
    return socket;
}

export { connectWebSocket, getSocket };
