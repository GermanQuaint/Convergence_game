# Convergence Game

Это многопользовательская игра в реальном времени, построенная с использованием Vue.js для клиентской части и Cloudflare Workers (Durable Objects) для серверной части.

## Технологии

*   **Клиент (Frontend):**
    *   [Vue.js](https://vuejs.org/)
    *   [Vite](https://vitejs.dev/)
    *   Нативные WebSockets
    *   [Sass](https://sass-lang.com/)

*   **Сервер (Backend):**
    *   [Cloudflare Workers](https://workers.cloudflare.com/)
    *   [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
    *   Нативные WebSockets

## Структура проекта

Проект разделен на две основные части:

*   `./client`: Содержит весь код внешнего интерфейса Vue.js.
*   `./server`: Содержит внутренний код Cloudflare Worker (Durable Object).

## Начало работы

### Предварительные требования

Убедитесь, что у вас установлен [Node.js](https://nodejs.org/) (который включает npm) и [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/).

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

### Запуск приложения (локально)

1.  **Запустите сервер (локально с Wrangler):**
    *   Перейдите в корневой каталог проекта (`Convergence_game`) и выполните:
    ```bash
    wrangler dev
    ```
    *   Wrangler запустит локальный сервер для вашего Worker.

2.  **Запустите клиент:**
    *   В другом терминале перейдите в каталог `client` и выполните:
    ```bash
    npm run dev
    ```
    *   Клиентское приложение будет доступно по адресу `http://localhost:5173` (или по другому адресу, указанному Vite).

### Развертывание на Cloudflare

1.  **Войдите в Cloudflare (если еще не сделали):**
    ```bash
    wrangler login
    ```

2.  **Разверните Worker:**
    *   Перейдите в корневой каталог проекта (`Convergence_game`) и выполните:
    ```bash
    wrangler deploy
    ```
    *   Wrangler развернет ваш Worker на Cloudflare.