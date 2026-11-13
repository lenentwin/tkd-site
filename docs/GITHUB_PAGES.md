# GitHub Pages: MFT39

Основной адрес: https://mft39.ru. Репозиторий: lenentwin/tkd-site, ветка main.

## Сборка и публикация

В Settings → Pages источник публикации должен быть **GitHub Actions**. Публикация корня main через Deploy from a branch отдаёт исходный index.html и не запускает Vite.

Workflow `.github/workflows/deploy.yml` запускается при push в main и вручную. Он использует Node.js 24, npm ci, lint, тесты, npm run build и node scripts/prepare-pages.mjs. Только dist загружается официальным actions/upload-pages-artifact; actions/deploy-pages публикует этот артефакт. Права pages:write и id-token:write выдаются только задаче deploy. Версии actions закреплены по SHA официальных тегов. DNS, backend и конфигурации авторизации workflow не изменяет.

Vite base равен `/`, поскольку сайт размещён на собственном домене. Существующий корневой CNAME не удаляется и копируется в dist/CNAME. В настройках Pages сохраняется mft39.ru. Автоматический выбор base по имени репозитория не используется.

Repository variable VITE_API_BASE_URL необязательна. Это только публичный HTTPS-адрес, не секрет. Пустое значение сохраняет текущую production-страницу отсутствия подключения. База данных и реальный OAuth этим изменением не подключаются.

## Прямые ссылки React Router

Подготовка артефакта копирует собранный index.html в 404.html. GitHub Pages отдаёт этот документ для внутренних путей, которых нет на диске; BrowserRouter открывает нужный маршрут. Абсолютные `/assets/...` работают и на вложенных путях. Query и hash остаются в адресной строке. Страница приложения «не найдена» сохраняется для неизвестных маршрутов.

Ограничение GitHub Pages: ответ такой навигации имеет HTTP 404, хотя приложение отображает нужный экран. Серверные rewrite с HTTP 200 платформа не поддерживает. Для строгих SEO-требований нужен отдельный этап prerender/SSG или хостинг с SPA rewrite. HashRouter не используется, существующие ссылки и якоря не меняются.

404.html создаётся только специальным шагом Pages. Обычная npm run build не создаёт его и сохраняет нативный SPA fallback для возможного Cloudflare Pages. Файлы _headers/_redirects GitHub Pages не интерпретирует; наличие этих файлов не доказывает установку HTTP-заголовков.

## Проверка

1. npm ci, npm run lint, npm test, npm run build.
2. node scripts/prepare-pages.mjs проверяет наличие собранных JS/CSS, отсутствие /src и .tsx в HTML и неизменный домен.
3. Успешные build/deploy в Actions, артефакт github-pages из dist.
4. https://mft39.ru/ отдаёт index.html со ссылками /assets/*.js и /assets/*.css, а не /src/main.tsx. Эти файлы возвращают 200 и правильный Content-Type.
5. Прямое открытие и обновление /coach, /contacts, /booking и неизвестного пути; проверка query/hash, тем и мобильного экрана. Для внутренних маршрутов учесть ограничение HTTP 404 выше.

Откат выполняется обычным git revert соответствующего коммита и повторным workflow; историю и DNS удалять не требуется.
