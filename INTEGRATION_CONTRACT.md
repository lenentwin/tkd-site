# Контракт интеграции MFT39

Оригинал: `C:/Users/manxinxx/Desktop/Prompt.md`, все 39 разделов. По уточнению владельца проект перенесён в папку со шрифтами `C:/Users/manxinxx/Desktop/TKD-39-REDESIGN`, имя пакета `mft39-redesign`. Старый рабочий каталог содержит ранний каркас и не является актуальной копией. Документы требований не являются разрешением на публикацию или изменение старого сайта.

## Владение файлами

Главный агент владеет package/config, `src/app/`, `src/content/`, `src/types/`, `src/editor/`, `src/services/`, `src/hooks/useMediaSource.ts`, `src/pages/{LoginPage,AccountPage,BookingPage}.tsx`, `src/main.tsx`, тестами и техническими документами.

Единственный субагент Creative Director & Motion Engineer владеет `src/sections/`, `src/scenes/`, `src/animations/`, `src/styles/`, `src/components/presentation/`, `src/pages/{HomePage,CoachPage,AchievementsPage,ContactsPage,RutubePage,VkPage}.tsx`, `public/`, `REFERENCE_ANALYSIS.md`, `DESIGN_SYSTEM.md`, своим отчётом. Пакеты/общие типы менять только через главного агента. У субагента нет права создавать дополнительных агентов.

## Данные и доступ

Уточнение от 13 ноября: задание на PHP backend имеет приоритет над прежним запретом реализации OAuth. Актуальный API/роли/сессии: backend/docs/API.md. UserSession теперь demo | server; AuthProvider дополнительно возвращает loading/unavailable. При VITE_AUTH_ENABLED=true и API https://api.mft39.ru signIn выполняет top-level переход на серверный start, профиль приходит через credentials:include, signOut требует настоящий logout. При выключенном флаге production остаётся not-connected. Исходный контракт demo ниже сохранён для локального режима; backend не реализует BookingService или публичную CMS.

- Типы и Zod-схема: `src/types/content.ts`. Инициализация: `src/content/site.content.ts`. Только одна модель `SiteContent`, version 1; публичные компоненты читают её через provider, не импортируют defaultContent для рендеринга.
- `import { useContent } from '../app/providers/ContentProvider'` (относительный путь по месту). Возвращает `{ content: SiteContent }`; редактору дополнительно доступны replaceContent/save/reset/undo/redo/dirty/error.
- `import { useTheme } from '../app/providers/ThemeProvider'`: `{ theme: 'dark' | 'light', toggleTheme(), setTheme(mode) }`. Атрибут `data-theme` на html, CSS variables `--accent`, `--accent-secondary`, `--grid-opacity`, `--transition-duration` устанавливаются provider. CSS базовых тем задаёт субагент.
- `import { useAuth } from '../app/providers/AuthProvider'`: `{ session: UserSession | null, signIn(): void, signOut(): void }`. Сессия только demo, без профиля реального человека. CTA: session ? `/booking` : `/login`; после signIn → `/account`.
- Локальное медиа хранится как Blob в IndexedDB; `src = 'idb:<id>'`. Используйте `import { useMediaSource } from '../../hooks/useMediaSource'` и `const src = useMediaSource(item.src)`. Для пустой строки возвращает пустую строку, для недоступного ID — пустую и можно показать placeholder. Не рисовать сломанный img.
- Медиа: `MediaItem` с id/src/title/alt/category/aspectRatio/focalPoint{x,y}/order/visible/usage/eventId?. usage = hero | gallery | coach. object-position берётся из focalPoint; aspectRatio 1:1 или 1:2.
- Секции `content.sections` управляют порядком и видимостью домашней страницы. Данные разделов/страниц берутся из одной модели. Все заголовки/абзацы/кнопки, которые содержатся в модели, редактор умеет изменять. Статические подписи действий допустимы в компонентах.
- locations, coaches, events, medals, video, reviews, contacts, theme, motion, pages имеют точную структуру в типах. Нет публичных цен. Медальные суммы и доли вычисляются. Только reviews с confirmed=true и оригинальной ссылкой выводятся публично.

## Компоненты и маршруты

- Публичные страницы — default exports: `HomePage`, `CoachPage`, `AchievementsPage`, `ContactsPage`, `RutubePage`, `VkPage` в одноимённых файлах.
- Субагент создаёт `src/components/presentation/SiteLayout.tsx`, default export `SiteLayout({ children }: { children: ReactNode })`. Содержит header/nav/mobile menu/theme switch/footer, skip-link к `#main`, читает актуальные данные, использует React Router Link/NavLink. Страницы сами содержат один `<main id="main">`.
- Основные общие CSS-классы для главного агента: `.page-shell`, `.container`, `.button`, `.button-secondary`, `.eyebrow`, `.demo-notice`. Глобальные стили: `src/styles/global.css` (главный агент импортирует его в main.tsx). Собственные editor/demo-стили главный агент держит в `src/editor/editor.css` и `src/app/demo.css`.
- Главный агент создаёт маршруты и lazy-load редактора `/editor`; layout оборачивает публичные и demo-страницы. `/gallery` перенаправляет на `/#gallery`. BrowserRouter, прямые URL поддерживает Vite SPA fallback.
- Карты: субагент создаёт интерфейс выбора залов/сервиса; главный агент поставляет `src/services/integrations.ts`: `getMapLink(location, provider: 'yandex'|'2gis'): string | null`, `getRutubeEmbed(url): string | null`, `getGmailLink(email): string`, `copyPhone(phone): Promise<void>`. Если twoGisUrl пуст — честный fallback без выдуманной ссылки/координат; можно дать общий переход на официальный 2ГИС, явно не называя маршрутом к залу.

## Motion, шрифты и проверка

GSAP установлен. CSS perspective достаточно для DOM-доступной 3D-композиции; Three.js не добавлять без необходимости. Разные контроллеры Hero и Gallery, физика и RAF вне React state; pause offscreen/hidden; cleanup. Mobile native scroll; reduced-motion без заставки/auto, доступные controls. После запроса владелец предоставил Bebas Neue Pro в Fonts/: в public/fonts подключены Regular, Bold, Book и ExpandedBold woff2. Проверка соответствующих TTF cmap подтвердила все 66 русских прописных/строчных букв, включая Ё/ё, в каждом начертании.

Перед кодом публичных компонентов субагент завершает исследование и REFERENCE_ANALYSIS.md с честными ограничениями, арт-направлением и мобильными альтернативами. Крупные этапы сверяются с REQUIREMENTS_CHECKLIST.md. Никаких публикаций/реального OAuth/персональных данных/фиктивной обработки записи.
