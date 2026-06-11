# Деплой на Render

## Что получится

Один Docker web service:

- собирает React Mini App;
- раздает фронтенд из Hono backend;
- запускает API и Telegram-бота 24/7;
- использует HTTPS-адрес Render как WebApp URL.

## Шаги

1. Загрузите этот репозиторий на GitHub.
2. Откройте Render Dashboard.
3. Выберите **New +** → **Blueprint**.
4. Подключите GitHub-репозиторий с этим проектом.
5. Render найдет `render.yaml` и покажет сервис `harmonic-mashup-tma`.
6. В поле `BOT_TOKEN` вставьте токен бота.
7. В поле `BEATPORT_CLIENT_ID` вставьте Client ID приложения Beatport.
8. В поле `BEATPORT_CLIENT_SECRET` вставьте Client Secret приложения Beatport.
9. Нажмите **Apply**.
10. Дождитесь статуса **Live**.
11. Откройте URL сервиса вида `https://harmonic-mashup-tma.onrender.com`.
12. В BotFather откройте настройки Mini App и укажите этот URL.
13. Для прямого запуска используйте `https://t.me/dj_tool_bot/djtool`.

## Важно

- На бесплатном Render-сервисе возможен холодный старт после простоя.
- Если вы смените имя сервиса, Render сам передаст новый адрес через `RENDER_EXTERNAL_URL`.
- Для Railway можно использовать тот же `Dockerfile`, но переменную `BOT_TOKEN` нужно добавить вручную в Variables.
