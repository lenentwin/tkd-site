import { z } from "zod";
import { applicationSchema, studentSchema, userRoleSchema } from "./club";
import { AccountBlockedError, fetchYandexSession } from "./yandexAuth";

export const permissions = ["applications.decide", "students.status", "payments.write", "students.archive", "students.restore"] as const;
export type Permission = typeof permissions[number];
export const deleteReasonLabels = { subject_request: "Запрос родителя или представителя", duplicate_record: "Дублирующая карточка", retention_expired: "Цели или сроки хранения завершены", other_reviewed: "Иное основание проверено" };
export type DeleteReasonCode = keyof typeof deleteReasonLabels;
export const permissionLabels: Record<Permission, string> = { "applications.decide": "Приём и отклонение заявок", "students.status": "Изменение статуса обучения", "payments.write": "Подтверждение и отмена оплаты", "students.archive": "Архивирование учеников", "students.restore": "Восстановление из архива" };
const permissionSchema = z.enum(permissions);
export const adminUserSchema = z.object({ id: z.number().int(), displayName: z.string(), firstName: z.string(), lastName: z.string(), middleName: z.string(), role: userRoleSchema, status: z.enum(["active", "blocked"]), createdAt: z.string(), lastLoginAt: z.string().nullable(), version: z.number().int(), hallScope: z.enum(["all", "assigned"]), hallIds: z.array(z.string()), overrides: z.record(z.string(), z.boolean()), effectivePermissions: z.array(permissionSchema) });
export const hallSchema = z.object({ id: z.string(), name: z.string(), address: z.string(), active: z.boolean(), version: z.number().int(), studentCount: z.number().int(), trainerIds: z.array(z.number().int()) });
export const adminStudentSchema = studentSchema.extend({ birthYear: z.number().int().nullable(), archived: z.boolean(), archivedAt: z.string().nullable(), archiveReason: z.string().nullable(), guardians: z.array(z.object({ id: z.number().int(), displayName: z.string(), relationship: z.enum(["parent", "guardian", "self"]) })) });
export const adminApplicationSchema = applicationSchema.extend({ applicant: z.object({ id: z.number().int(), displayName: z.string() }) });
export const auditEventSchema = z.object({ id: z.number(), studentId: z.string().nullable(), hallId: z.string().nullable(), actorId: z.number().nullable(), actorName: z.string().nullable(), action: z.string(), entityId: z.string(), details: z.record(z.string(), z.unknown()), createdAt: z.string() });
const page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), page: z.number().int(), pages: z.number().int(), total: z.number().int() });
const envelope = z.object({ ok: z.literal(true), currentMonth: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), serverTime: z.string() });
export type AdminUser = z.infer<typeof adminUserSchema>;
export type Hall = z.infer<typeof hallSchema>;
export type AdminStudent = z.infer<typeof adminStudentSchema>;
export type AdminApplication = z.infer<typeof adminApplicationSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AccessDraft = Pick<AdminUser, "role" | "hallScope" | "hallIds" | "overrides">;
export type Query = Record<string, string | number>;
const messages: Record<string, string> = {
  last_active_admin: "Нельзя заблокировать или лишить прав последнего активного администратора. Сначала назначьте другого активного администратора.",
  version_conflict: "Запись уже изменена другим сотрудником. Закройте карточку и обновите список перед повторным изменением.",
  account_blocked: "Аккаунт заблокирован. За восстановлением доступа обратитесь к администратору клуба.",
  forbidden: "Для этого действия недостаточно прав. Обновите страницу, чтобы проверить текущий доступ.",
  unauthenticated: "Сессия завершилась. Войдите через Яндекс снова.",
  retention_restricted: "Удаление ограничено правилами хранения данных. Проверьте основания и сохранность обязательных записей.",
  student_not_archived: "Окончательное удаление доступно только для архивированной карточки.",
  archive_required: "Сначала архивируйте карточку ученика.",
  retention_review_required: "Подтвердите проверку оснований хранения и права на удаление данных.",
  permissions_changed: "Права доступа изменились. Обновите страницу, чтобы проверить текущий доступ.",
  archive_state_conflict: "Состояние архива уже изменилось. Обновите список перед повторным действием.",
  migration_required: "Сервис ожидает обновления серверной части. Обратитесь к администратору клуба.",
  invalid_fields: "Проверьте обязательные поля. Причина должна быть записана одной строкой.",
  confirmation_mismatch: "ФИО подтверждения не совпадает с карточкой ученика.",
  not_found: "Запись не найдена или больше недоступна.",
  validation_error: "Проверьте обязательные поля и повторите действие.",
};
export class AdminError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(messages[code] ?? (status === 422 ? "Проверьте заполнение полей." : status === 0 ? "Нет связи с сервером. Проверьте подключение и повторите запрос." : "Административный сервис временно недоступен. Повторите запрос позже.")); }
}
async function request<T extends z.ZodRawShape>(resource: string, shape: T, query: Query = {}, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    let value: Awaited<ReturnType<typeof fetchYandexSession>>;
    try { value = await fetchYandexSession(); } catch (cause) { if (cause instanceof AccountBlockedError) { window.dispatchEvent(new Event("mft39:account-blocked")); throw new AdminError(403, "account_blocked"); } throw new AdminError(0, "unavailable"); }
    if (!value.session || !value.csrfToken) { window.dispatchEvent(new Event("mft39:session-expired")); throw new AdminError(401, "unauthenticated"); }
    headers["Content-Type"] = "application/json"; headers["X-CSRF-Token"] = value.csrfToken;
  }
  let response: Response;
  try { response = await fetch(`https://api.mft39.ru/api/club/index.php?${new URLSearchParams({ resource, ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])) })}`, { method: body === undefined ? "GET" : "POST", credentials: "include", cache: "no-store", headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) }); }
  catch { throw new AdminError(0, "unavailable"); }
  if (!response.ok) {
    let code = "unavailable";
    try { const value: unknown = await response.json(); if (value && typeof value === "object" && "error" in value && typeof value.error === "string") code = value.error; } catch { /* Server text never enters the UI. */ }
    if (response.status === 401) window.dispatchEvent(new Event("mft39:session-expired"));
    if (code === "account_blocked") window.dispatchEvent(new Event("mft39:account-blocked"));
    if (response.status === 403) window.dispatchEvent(new Event("mft39:access-changed"));
    throw new AdminError(response.status, code);
  }
  let json: unknown; try { json = await response.json(); } catch { throw new AdminError(502, "invalid_response"); }
  const parsed = envelope.extend(shape).safeParse(json);
  if (!parsed.success) throw new AdminError(502, "invalid_response");
  return parsed.data;
}
export const adminApi = {
  overview: () => request("admin-overview", { counts: z.object({ students: z.number(), trial: z.number(), permanent: z.number(), inactive: z.number(), pending: z.number(), unpaid: z.number(), halls: z.number(), trainers: z.number(), archived: z.number() }), events: z.array(auditEventSchema) }),
  users: (query: Query) => request("admin-users", page(adminUserSchema).shape, query),
  user: (userId: number) => request("admin-user", { user: adminUserSchema }, { userId }),
  preview: (userId: number, draft: AccessDraft) => request("admin-permissions-preview", { effectivePermissions: z.array(permissionSchema), hallScope: z.enum(["all", "assigned"]), hallIds: z.array(z.string()) }, {}, { userId, ...draft }),
  saveUser: (user: AccessDraft & { userId: number; status: AdminUser["status"]; expectedVersion: number; reason: string }) => request("admin-user-update", { user: adminUserSchema }, {}, user),
  halls: () => request("admin-halls", { items: z.array(hallSchema) }),
  saveHall: (body: Pick<Hall, "id" | "name" | "address" | "active"> & { expectedVersion: number; reason: string }) => request("admin-hall-save", { hall: hallSchema }, {}, body),
  students: (query: Query) => request("admin-students", page(adminStudentSchema).shape, query),
  applications: (query: Query) => request("admin-applications", page(adminApplicationSchema).shape, query),
  archive: (studentId: string, expectedVersion: number, reason: string) => request("student-archive", { student: adminStudentSchema }, {}, { studentId, expectedVersion, reason }),
  restore: (studentId: string, expectedVersion: number, reason: string) => request("student-restore", { student: adminStudentSchema }, {}, { studentId, expectedVersion, reason }),
  deletePreview: (studentId: string) => request("student-delete-preview", { studentId: z.string(), fullName: z.string(), version: z.number().int(), related: z.object({ applications: z.number(), payments: z.number(), guardians: z.number(), audit: z.number() }), eligible: z.boolean(), limitation: z.string().nullable() }, { studentId }),
  delete: (studentId: string, expectedVersion: number, confirmation: string, reason: string, reasonCode: DeleteReasonCode) => request("student-delete", { deleted: z.literal(true), studentId: z.string() }, {}, { studentId, expectedVersion, confirmation, reason, reasonCode, retentionReviewed: true }),
  audit: (query: Query) => request("admin-audit", page(auditEventSchema).shape, query),
};
