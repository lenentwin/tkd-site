# MFT39

Сайт клуба тхэквондо МФТ в Калининграде. React 19, TypeScript strict, Vite, GSAP. Backend и база данных не подключены.

## Локальный запуск

Node.js 24 LTS (см. .node-version), npm. Из корня репозитория:

```sh
npm ci
npm run dev
```

Адрес: http://127.0.0.1:5173. Локальный редактор /editor, демонстрационные вход/кабинет/запись доступны только в режиме разработки. Они не являются настоящей авторизацией. Контент редактора хранится в браузере. Для production перенесите одобренные тексты в src/content/site.content.ts, фотографии в public/images и задайте относительные src. Ссылки idb: и экспорт без файлов не переносятся на сервер автоматически.

## Проверки и production

```sh
npm run lint
npm test
npm run build
npm run preview
```

Сборка: dist. Preview: http://127.0.0.1:4173. Production исключает демо-страницы и редактор; /editor показывает страницу «не найдена». /login, /account и /booking сообщают об отсутствии подключения и ведут к контактам. Нет формы сбора персональных данных, поддельного успешного входа или заявки. Локальные CMS-снимки и сообщения редактора игнорируются в production.

При отсутствии реальных фотографий Hero использует фирменные векторные иллюстрации; пустая фотогалерея скрыта. Это не фотографии воспитанников. Перед полноценным запуском добавьте согласованные фотографии/видеоролик и проверьте права на предоставленные веб-шрифты. Текущий src сохраняет все сцены и управление для реальных материалов.

## GitHub Pages: mft39.ru

Публикация из `main` выполняется через `.github/workflows/deploy.yml`: Node.js 24, `npm ci`, lint/test, `npm run build`, подготовка Pages и загрузка только `dist` официальными `actions/upload-pages-artifact` и `actions/deploy-pages`. Исходный `index.html` с `/src/main.tsx` публиковать нельзя. В Settings → Pages → Build and deployment → Source выберите **GitHub Actions**, сохранив Custom domain `mft39.ru`.

Vite использует `base: "/"`. Корневой `CNAME` сохранён и копируется в артефакт. Необязательная Actions repository variable `VITE_API_BASE_URL` содержит только публичный HTTPS-адрес API; без неё сборка сохраняет состояние отсутствия подключения. Секреты авторизации в Actions variables/VITE_* не добавляются.

Для прямого открытия маршрутов `node scripts/prepare-pages.mjs` создаёт `dist/404.html` из собранного `index.html`. React Router получает исходный путь, параметры и якорь без перенаправлений. GitHub Pages отвечает HTTP 404 на отсутствующий статический путь, но загружает рабочую страницу приложения; это ограничение платформы для SPA. `_headers` и `_redirects` относятся к Cloudflare и не применяются GitHub Pages. Подробности и проверка: `docs/GITHUB_PAGES.md`.

## Cloudflare Pages (альтернативный хостинг)

Подключите GitHub lenentwin/tkd-site в Pages (Git integration), framework preset Vite:

| Параметр | Значение |
| --- | --- |
| Production branch | main |
| Root directory | / (корень репозитория; поле можно оставить пустым) |
| Build command | npm run build |
| Build output directory | dist |
| NODE_VERSION | 24 |
| VITE_API_BASE_URL | оставить пустым |

Установка зависимостей по package-lock.json; локально проверяется npm ci. Используется нативный SPA fallback Pages без верхнеуровневого 404.html (пояснение в public/_redirects), защитные заголовки и кэш статических hashed assets в public/_headers. Здесь нет Pages Functions, Workers, D1 или иной базы. CSP запрещает сторонние скрипты и отправку форм; inline styles разрешены для React/GSAP, inline scripts/eval запрещены. Внешние карты и видео разрешены только с указанных официальных origins.

Vite preview не применяет Cloudflare _headers/_redirects как edge-конфигурацию. После первого развёртывания проверьте прямое открытие /coach, /contacts и /booking, реальный CSP и iframe карт. Настройте собственный домен, SEO/OG и предварительный рендер при необходимости. Индексация служебных маршрутов закрыта; публичные страницы открыты. Деплой Cloudflare не выполняется этим репозиторием автоматически.

## Backend и Яндекс ID

.env.example содержит только публичный VITE_API_BASE_URL. VITE_* попадает в JS браузера и никогда не должен содержать секретов. Непустой адрес должен использовать HTTPS без credentials, query и fragment. В src/services/backend.ts статус остаётся not-connected: один адрес не включает несуществующий API. При внедрении адаптера отдельно согласуйте endpoint-контракт и добавьте точный backend origin в connect-src CSP.

Будущий backend размещается отдельно в России. Яндекс OAuth CLIENT_SECRET, state/session keys, токены и доступ к российской базе хранятся только там. Сервер начинает OAuth, проверяет state и привязку callback, обменивает code на token сервер-сервер и выдаёт защищённую сессию; фронтенд не принимает токены через URL и не хранит их в localStorage. Реальный OAuth пока не включён. Подробнее: docs/DEPLOYMENT.md.

Не включайте Cloudflare Web Analytics, Zaraz, сторонние error/форм-сервисы для передачи анкет. Ни анкеты, ни токены не должны попадать в GitHub, Cloudflare Functions/D1 или логи запросов. Публичные контакты клуба уже были предоставлены как контент.

## Документация

Текущие результаты и границы: docs/RELEASE_AUDIT.md, docs/RELEASE_AUDIT_INVENTORY.md и docs/DEPLOYMENT.md. Исторические отчёты описывают предыдущий локальный прототип; при конфликте production-поведение определяют эти документы и текущий код. Оригинальные ТЗ и архивы Fonts сохранены локально и исключены из Git; REQUIREMENTS_CHECKLIST.md сохраняет контроль 39 разделов. Исходная лицензия проекта и лицензия веб-шрифтов не подменяются выдуманной open-source лицензией.

