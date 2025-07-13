# Convergence Game

Это многопользовательская игра в реальном времени, построенная с использованием Vue.js для клиентской части и Node.js с Express и Socket.IO для серверной части.

## Технологии

*   **Клиент (Frontend):**
    *   [Vue.js](https://vuejs.org/)
    *   [Vite](https://vitejs.dev/)
    *   [Socket.IO Client](https://socket.io/docs/v4/client-api/)
    *   [Sass](https://sass-lang.com/)

*   **Сервер (Backend):**
    *   [Node.js](https://nodejs.org/)
    *   [Express](https://expressjs.com/)
    *   [Socket.IO](https://socket.io/)

## Структура проекта

Проект разделен на две основные части:

*   `./client`: Содержит весь код внешнего интерфейса Vue.js.
*   `./server`: Содержит внутренний код Node.js/Express.

## Начало работы

### Предварительные требования

Убедитесь, что у вас установлен [Node.js](https://nodejs.org/) (который включает npm).

### Установка

1.  **Клонируйте репозиторий:**
    ```bash
    git clone https://github.com/GermanQuaint/Convergence_game.git
    cd Convergence_game
    ```

2.  **Установите зависимости клиента:**
    ```bash
    cd client
    npm install
    ```

3.  **Установите зависимости сервера:**
    ```bash
    cd ../server
    npm install
    ```

### Запуск приложения

1.  **Запустите сервер:**
    *   Перейдите в каталог `server` и выполните:
    ```bash
    npm start
    ```
    *   Сервер запустится на `http://localhost:3000` (или на порту, указанном в `server/index.js`).

2.  **Запустите клиент:**
    *   В другом терминале перейдите в каталог `client` и выполните:
    ```bash
    npm run dev
    ```
    *   Клиентское приложение будет доступно по адресу `http://localhost:5173` (или по другому адресу, указанному Vite).
