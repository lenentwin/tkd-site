# MFT39 Club API, schema 2

Base: `https://api.mft39.ru/api/club/index.php?resource=...`. HTTPS only. JSON, `Cache-Control: no-store`. PHP 8.3, PDO MySQL, MySQL 8.0+ InnoDB. No D1, external database or payment processor.

## Authentication and scope

Browser: existing host-only HttpOnly `__Host-mft39` cookie; `credentials: include`; exact Origin `https://mft39.ru`. Every POST also needs current `X-CSRF-Token` from `/api/me/`, and `Content-Type: application/json`. The physical index.php avoids the hosting directory OPTIONS limitation. No CSRF token in persistent browser storage.

Native: `Authorization: Bearer <personal-device-token>`, no Cookie/Origin. This is a random 256-bit access capability, not a Yandex OAuth token or a role claim. Only its SHA-256 hash is stored. 8-hour expiry, max 5 active per staff account, owner revocation. A browser session is required to issue/revoke; native tokens cannot issue further tokens. Current user status, staff role and hall grants are checked server-side on every call. An expired/revoked token returns 401; role loss returns 403.

User: only students linked through club_student_guardians and applications created by that account. Trainer: assigned halls only. Head trainer/admin: all halls. Parents cannot make staff mutations. Foreign IDs return 404 when scoped. `view=own` on read endpoints reduces scope to personal guardian links, including when the account also has a staff role. It does not elevate authority or alter mutation permissions.

All responses include `ok`, `currentMonth` (YYYY-MM, Europe/Kaliningrad), `serverTime` (ISO 8601 UTC). Errors: non-2xx JSON `{ok:false,error,currentMonth}`. Never infer success from transport completion. Unknown schema/404/503 means feature unavailable. Body limit 128 KiB; 1–20 students; general 600 requests / 600s and enrollment 30 / 600s per user; 429 Retry-After 600.

## GET endpoints

| resource | Query | Result beyond common fields |
|---|---|---|
| bootstrap | none | schemaVersion:2, actor:{id,role}, staff, halls:[{id,name,address,active}], scopeVersion, cursor |
| students | status=active/all/trial/permanent/inactive, cursor=last UUID, optional view=own | items:Student[], nextCursor:null or UUID; limit 100; staff lists only admitted students; personal lists include pending/unadmitted |
| student | studentId, optional view=own | single Student |
| applications | status=all/pending/accepted/rejected, cursor=last UUID, optional view=own | items:Application[], nextCursor; limit 100 |
| payments | studentId, cursor=exclusive YYYY-MM before which to read, optional view=own | items:[{month,status,version,confirmedBy,confirmedAt,updatedBy,updatedAt}], nextCursor; newest first, 100 months; missing rows are unpaid/version 0 with null metadata from registration month onwards |
| changes | after=numeric audit ID, optional studentId, view=own | items:[{id,studentId,locationId,actorId,action,entityId,details,createdAt}], cursor, hasMore; ascending 100 events, same read scope |
| devices | browser staff only | items:[{id,label,created_at,expires_at,revoked_at}], timestamps Unix seconds |

Student: `{id,locationId,lastName,firstName,middleName,age,ageRecordedOn,status,admitted,createdAt,version,payment:{month,status,version}}`. Age is the recorded age, not silently incremented from an unknown birth date. Learning status is trial/permanent/inactive, distinct from user role. Application: `{id,studentId,locationId,lastName,firstName,middleName,age,requestedDate,comment,guardian,status,version,createdAt}`. guardian is null for adults, otherwise name, relationship parent/guardian and phone. requestedDate is a local date, not confirmation of a scheduled slot.

## POST endpoints

`applications`: additional header `Idempotency-Key` (16–80 ASCII letters/digits/_/-; UUID accepted). Body:

```json
{
  "students":[{"lastName":"Фиктивный","firstName":"Пример","middleName":"","age":10}],
  "guardian":{"lastName":"Фиктивный","firstName":"Родитель","middleName":"","phone":"+70000000000","relationship":"parent"},
  "locationId":"chelnokova","requestedDate":"2027-01-20","comment":"Синтетический пример"
}
```

Names 1–80 letters/spaces/hyphen/apostrophe; middle name optional; integer age 1–120; valid date >= today's Kaliningrad date; comment optional up to 1000 characters. Representative required if any minor. Optional students[].id may reuse only an existing OWN linked student, with matching server name/age. Without id, matching is only within the applicant's own family. Hall change/inactive reactivation require the coach. Entire batch is transactional. Response `{batchId,applicationIds,replayed}`; pending is actually persisted. Reuse the SAME key and identical logical input after uncertain network failure; same key/different input =409. Duplicate student/hall/date (including already decided applications) =409. UI cannot assume a successful retry without a validated reply or fetching its actual saved requests.

Other POST bodies/results:

| resource | Body | Result |
|---|---|---|
| application-decision | id, status:accepted/rejected, expectedVersion | id,status,version |
| student-status | studentId, status:trial/permanent/inactive, expectedVersion, reason optional max500 | id,status,version |
| payment | studentId, month:YYYY-MM, status:paid/unpaid, expectedVersion, expectedCurrentMonth, reason optional max500 | studentId,month,status,version |
| device-create | label max80, browser staff only | id,token (shown once),expiresAt Unix seconds |
| device-revoke | id, browser staff owner only | id,revoked:true |

Only accepted applications set admitted_at. Rejected first applications leave new students unadmitted. Neither admission nor learning status automatically confirms payment. Inactive students/history remain in DB.

Payment is a MANUAL accounting mark, no bank operation. `(student_id,month)` primary key prevents duplicates. No monthly reset writes/CRON: the requested current month is calculated from Europe/Kaliningrad every time and a missing row means unpaid. Stored prior months stay intact. Corrections preserve audit snapshots and last confirmer/date; paid→unpaid and ANY past-month write require a reason. Future months and months before registration cannot be written. Version 0 means no physical payment row. Two concurrent version-0 writes yield one success and a 409, never two rows. `expectedCurrentMonth` must equal server current month, including Dec→Jan. Versions are separate for student, application and each payment month.

On 409 version_conflict or month_changed: fetch fresh state and history, show it to the user, then require an explicit new decision with the fresh version. NEVER automatically rebase/retry an old phone intent onto the newest version. 401 requires login; 403/404 clear inaccessible cached personal data. Some errors: duplicate_application, idempotency_conflict, student_changed, admission_required, correction_reason_required, hall_change_requires_trainer, reactivation_requires_trainer, device_limit.

## Synchronization

bootstrap.cursor / changes provide invalidation and history, not an immutable snapshot transaction. Audit IDs are allocated before commit and a late transaction can become visible after a higher ID; UUID pagination also allows concurrent inserts before a cursor. Therefore do NOT build correctness on a forever-increasing cursor alone. On login, reconnect, foreground, permissions change, month change and periodic refresh fetch a COMPLETE paginated snapshot of students and pending applications, plus current payment month. Replace old accessible caches, do not append indefinitely. Poll changes for quick refresh/history; refetch history from the beginning when reconciling. Fetch fresh state/version before any queued mutation; a conflict requires a human decision. Full reload protects against delayed commits, inactive/removed scope and insertions during pagination. Website refreshes bootstrap/snapshots on focus/visibility and every 60s; writes refresh affected lists. History loads all pages on demand.

The server is authoritative. Offline cached paid can be displayed only for the same calendar month; rollover must show unpaid/unknown, never last month's paid. See ANDROID_CLUB.md.

## Data location and operational requirements

Only Russian api.mft39.ru/MySQL receives real personal information. No analytics, external error reporting, request-body logging or personal test data in GitHub. Web server/proxy must exclude query, Cookie, Authorization and bodies from logs; existing OAuth callback rules remain mandatory. App exceptions log one fixed marker only. Runtime DB account should have SELECT/INSERT/UPDATE on club data, SELECT/INSERT only on club_audit, and required old auth cleanup permissions; DDL/grant administration belongs to separate owner credentials. bin/ is private CLI, never web accessible.

Concurrency uses explicit transactions and row locks; see the [MySQL locking documentation](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html). Production hosting was not changed by development; owner installation instructions are in DEPLOYMENT_CLUB_RU.md.