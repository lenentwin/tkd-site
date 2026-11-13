# Развёртывание MFT39

Актуально на 13 ноября 2026. Только статический frontend; D1/Workers/Functions/БД не используются.

## Cloudflare Pages

Git integration: `lenentwin/tkd-site`, branch `main`, preset `Vite`, root `/` (пустое поле), build `npm run build`, output `dist`, env `NODE_VERSION=24`, `VITE_API_BASE_URL=`. Production и Preview настраиваются отдельно. Не добавляйте секреты OAuth или БД в frontend environment. `npm ci` воспроизводит package-lock; Node24 задан в .node-version и engines.

Используется нативный SPA fallback Pages: верхнеуровневого `404.html` нет, поэтому существующие assets обслуживаются как файлы, а остальные пути получает React Router. `public/_redirects` содержит пояснение, без опасного catch-all rewrite статических assets. `public/_headers` задаёт CSP/nosniff/referrer/permissions/cache и noindex для служебных URL. Заголовки Pages действуют на edge, Vite preview их не читает. `qa-release.mjs` отдельно подставляет точный CSP в ответы браузеру для проверки совместимости; это не доказательство фактического развёртывания Cloudflare.

После первого размещения: открыть напрямую и обновить `/coach`, `/contacts`, `/booking`, проверить статус/Content-Type JS и CSS; проверить HTTP-заголовки CSP и noindex служебных страниц; переключить темы и залы, открыть Яндекс iframe и RuTube. Для собственного домена обновить canonical/OG, проверить индексирование и при необходимости добавить prerender/SSG. Cloudflare Preview также следует закрыть от индексации. Не включать аналитику/сторонние обработчики форм/ошибок, отправляющие пользовательские данные.

Документация: [React на Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/), [SPA/Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/), [public Vite env](https://vite.dev/guide/env-and-mode).

## Российский backend и Яндекс ID

Сейчас backendStatus всегда `not-connected`, форм заявок и POST нет. Непустой VITE_API_BASE_URL проверяется как HTTPS без credentials/query/fragment. Он задаёт адрес будущего API, но не включает выдуманные endpoints. Согласование и реализация AuthService/BookingService остаются отдельным этапом; при подключении дополнить connect-src точным origin, тестировать CORS с конкретным frontend origin, CSRF и защищённые cookies. Не разрешать CORS `*` для credentialed requests.

На российском сервере, вне frontend и вне этого репозитория, потребуются `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, зарегистрированный `YANDEX_REDIRECT_URI`, ключи серверной сессии и российская БД. Значения не предоставлены и не генерировались. Сервер генерирует и проверяет одноразовый state, связывает callback с исходной сессией, выполняет code exchange сервер-сервер и хранит OAuth токены на своей стороне; при выбранном поддерживаемом потоке использовать PKCE. Обратно в браузер возвращается защищённая сессия, не access_token в query/localStorage. Ответы OAuth/анкеты не писать в логи. [Официальный code flow Яндекса](https://yandex.ru/dev/id/doc/ru/codes/code-url).

Размещение БД в России должно быть подтверждено оператором инфраструктуры; домен .ru сам по себе не доказывает местонахождение сервера. В текущем frontend нет отправки реальных анкет ни в российские, ни в зарубежные базы. Яндекс Карты/RuTube остаются сторонними iframe и получают обычные сетевые обращения браузера; они не являются обработчиками формы записи.

## Контент перед публичным запуском

LocalStorage/IndexedDB с вашего компьютера не включаются в Git. Для публикации выбранных материалов экспортируйте их из локального редактора, перенесите реальные изображения в public/images и обновите src/content/site.content.ts. Без src фотогалерея скрыта, а Hero показывает существующую фирменную SVG-графику, сохраняя движение. Числа/адреса/контакты взяты из исходного задания; выдуманные отзывы/цены не добавляются. Проверьте права на веб-шрифты и согласия на фотографии; автоматическая выдача open-source лицензии этим проектом не выполнялась.
