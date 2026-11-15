# Административный API MFT39

Единый endpoint: https://api.mft39.ru/api/club/index.php?resource=RESOURCE. Используется существующая MySQL mft39_auth, миграция003 после001/002. GET читает, POST изменяет. Web: credentials:include, cache:no-store, точный Origin https://mft39.ru, JSON и X-CSRF-Token из /api/me. Все права вычисляет сервер при каждом запросе.

## Роли и охват

user видит свою семью и редактирует свой профиль. trainer работает только с назначенными залами. head_trainer по умолчанию имеет все залы, hallScope=assigned ограничивает его назначениями. admin управляет всем клубом.

Разрешения: applications.decide, students.status, payments.write, students.archive, students.restore. У trainer по умолчанию первые три, у head_trainer все пять. Индивидуальное false запрещает, true разрешает только внутри охвата. У user нет staff-разрешений. Права admin фиксированы. Назначения и изменения прав сериализуются через club_access_lock; mutation проверяет свежую version внутри транзакции. Нельзя заблокировать/понизить последнего активного admin, включая конкурентные запросы.

Блокировка завершает существующие сессии и отзывает device-токены. Разблокировка старую сессию не возобновляет. Изменение прав также отзывает device-токены: требуется повторное подключение приложения.

## GET

Все admin-* и student-delete-preview доступны только admin.

| resource | Параметры | Результат |
|---|---|---|
| admin-overview | нет | counts:{students,trial,permanent,inactive,pending,unpaid,halls,trainers,archived},events |
| admin-users | q,role,status,page | items,page,pages,total |
| admin-user | userId | user |
| admin-halls | нет | items |
| admin-students | q,hall,status,payment,month,archived=0/1,from,to,page | items,page,pages,total |
| admin-applications | q,hall,status,page | items,page,pages,total |
| admin-audit | q,action,actorId,userId,studentId,hall,from,to,sort=asc/desc,page | items,page,pages,total |
| student-delete-preview | studentId | studentId,fullName,version,related:{applications,payments,guardians,audit},eligible,limitation |
| profile | нет | profile текущего пользователя |
| students | прежние параметры + archived=1 | прежний scoped список, по умолчанию без архива |

Admin-страницы по50, page от1 до9999. Даты включают календарный день Europe/Kaliningrad; SQL хранит UTC. Архив фильтруется по archived_at, рабочий состав по created_at. month=YYYY-MM, отсутствующая запись означает unpaid. Возраст текущего года не меняется при выборе прошлого месяца оплаты.

Обзор: students/статусы считают неархивированные карточки, включая ещё не зачисленных. unpaid считает зачисленных неархивированных, кроме inactive. Pending исключает архив. Число залов считает активные, тренеров действующие trainer/head_trainer. Архив показан отдельно. Это реальные SQL-результаты, без демонстрационных значений.

User: id,displayName,firstName,lastName,middleName,role,status,createdAt,lastLoginAt,version,hallScope,hallIds,overrides,effectivePermissions. Hall: id,name,address,active,version,studentCount,trainerIds. Audit: id,studentId,hallId,actorId,actorName,action,entityId,details,createdAt. Yandex user ID и секреты не выдаются.

## POST

| resource | JSON |
|---|---|
| admin-permissions-preview | userId,role,hallScope,hallIds,overrides |
| admin-user-update | userId,role,status,hallScope,hallIds,overrides,expectedVersion,reason |
| admin-hall-save | id,name,address,active,expectedVersion,reason |
| student-archive / student-restore | studentId,expectedVersion,reason |
| student-delete | studentId,expectedVersion,confirmation,reason,reasonCode,retentionReviewed:true |
| profile | firstName,lastName,middleName,expectedVersion |
| student-birth-year | studentId,birthYear,expectedVersion |

Preview возвращает эффективные права до сохранения. User-update возвращает user, hall-save hall, archive/restore/birth-year student. Новый зал требует expectedVersion=0. ID зала не меняется, физического удаления залов нет.

Архивирование отдельно от learning_status: сохраняются прежний статус, admitted_at, заявки, оплаты и история. Решения по заявкам, статусу и оплате архивированной карточки запрещены до восстановления. Trainer может archive/restore только с отдельными разрешениями и в своём охвате. Неактивный неархивированный ученик остаётся в обычном фильтре inactive.

Delete только admin, только архив, с точным ФИО из preview и актуальной version. Основание reasonCode обязательно: subject_request / duplicate_record / retention_expired / other_reviewed. Свободный reason проверяется, но не сохраняется в минимальном событии, чтобы не оставить детские ПД в причине.

Одна транзакция удаляет ученика, заявки, месячные оплаты и связи. Родительские аккаунты сохраняются. Старые события сохраняют действие/время/сотрудника, но теряют student_id и свободные детали; добавляется student.deleted с кодом основания и счётчиками. Старые idempotency keys становятся tombstone: повтор получает410 application_removed и не воссоздаёт ребёнка. Другие дети общей заявки сохраняются. SQL-ошибка откатывает всё. Журнал не редактируется/не удаляется административным API; ограниченное обезличивание является частью удаления ученика. Массового удаления нет.

## Имена и год рождения

Яндекс ID первоначально заполняет разрешённые first_name/last_name/display_name/real_name. После ручного изменения ФИО повторный вход его не перезаписывает. Отчество может отсутствовать, пользователь дополняет его сам. Аватар, email, телефон и дата рождения аккаунта не сохраняются. ФИО из аккаунта не доказывает юридическую личность или родство.

Состав ответа зависит от прав OAuth: [официальный контракт Яндекса](https://yandex.ru/dev/id/doc/ru/user-information). Если полей имени нет, пользователь может заполнить профиль; действующие client ID, секреты и callback автоматически не меняются. Уже вошедшему пользователю для первичной инициализации имени нужен новый OAuth-вход.

В student.guardians приходят id/displayName/relationship, в application.applicant id/displayName с текущим именем аккаунта. Исторический представитель, введённый при записи, остаётся отдельным снимком.

Новый сайт передаёт birthYear. Возраст = текущий год Europe/Kaliningrad минус год рождения, UI пишет «лет в этом году»: точный день рождения не собирается. В год18-летия также требуется представитель, поскольку день рождения неизвестен. Старые Android-запросы с age принимаются как снимок, birth_year остаётся NULL. Миграция не угадывает год. Связанный родитель может уточнить его, staff в своём зале с students.status. Изменения версионируются и аудируются.

В /api/me добавлены имена/displayName/version. В UI user скрыты его ID/роль; staff видит свою роль и внутренний ID. Для внутренних проверок сервер продолжает использовать эти поля. POST profile не принимает role/status/avatar/чужой userId.

## Совместимость и ошибки

Web bootstrap: schemaVersion3, capabilitiesVersion3, permissions, scopeVersion. Native bearer bootstrap сохраняет schemaVersion2 и добавляет capabilitiesVersion3/permissions. URL, bearer/cookies/CSRF и прежние age/ageRecordedOn/payment поля сохранены. Клиент должен игнорировать неизвестные JSON-поля. Android-исходников здесь нет: конкретный APK не изменён и требует проверки в своём проекте. Новый клиент учитывает permissions/архив/birthYear и очищает недоступные данные при scopeVersion/403.

Все успехи Club API содержат ok:true,currentMonth,serverTime. Ошибки не отражают SQL/upstream/PII и не изображают сохранение. 403 account_blocked показывает понятный экран, callback ведёт на /login?error=account_blocked. 409 last_active_admin/version_conflict/archive_required/archive_state_conflict/student_archived требует нового решения. 422 confirmation_mismatch/retention_review_required/invalid_birth_year/invalid_permissions требует исправления ввода. 503 migration_required требует обновления сервера. Автоматической очереди/повтора записей нет.

## Ограничения удаления

Разрешение admin и checkbox не устанавливают законность удаления. Оператор проверяет цель обработки, обращение представителя, договоры, обязательства хранения и резервные копии. Если основание не подтверждено либо хранение необходимо, используется архив.

Основа для проверки: [152-ФЗ, статьи5 и21 на официальном сайте Росгвардии](https://rosguard.gov.ru/document/article/federalnyj-zakon-ot-27-iyulya-2006-g--152fz). Перед production-удалением требуется актуальная редакция и проверка обязанностей конкретного клуба. Универсальный срок хранения программа не назначает. Процедура очищает рабочую БД; уничтожение внешних backup/бумажных договоров не заявляется.
