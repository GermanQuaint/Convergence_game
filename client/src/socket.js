
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000'); // Укажите адрес вашего сервера

export default socket;
