import { z } from "zod";
import { AccountBlockedError, fetchYandexSession } from "./yandexAuth";
import type { TrainingBookingRequest } from "../types/trainingBooking";

export const userRoleSchema = z.enum(["user", "trainer", "head_trainer", "admin"]);
export const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const paymentSchema = z.object({ month: monthSchema, status: z.enum(["paid", "unpaid"]), version: z.number().int().nonnegative() });
export const studentSchema = z.object({
  id: z.uuid(), locationId: z.string(), lastName: z.string(), firstName: z.string(), middleName: z.string(), age: z.number().int(),
  ageRecordedOn: z.string(), status: z.enum(["trial", "permanent", "inactive"]), admitted: z.boolean(), createdAt: z.string(), version: z.number().int(), payment: paymentSchema,
  birthYear: z.number().int().nullable().default(null), archived: z.boolean().default(false), archivedAt: z.string().nullable().default(null), archiveReason: z.string().nullable().default(null),
  guardians: z.array(z.object({ id: z.number().int(), displayName: z.string(), relationship: z.enum(["parent", "guardian", "self"]) })).default([]),
});
const guardian = z.object({ lastName: z.string(), firstName: z.string(), middleName: z.string(), phone: z.string(), relationship: z.enum(["parent", "guardian"]) });
export const applicationSchema = z.object({
  id: z.uuid(), studentId: z.uuid(), locationId: z.string(), lastName: z.string(), firstName: z.string(), middleName: z.string(), age: z.number().int(),
  requestedDate: z.string(), comment: z.string(), guardian: guardian.nullable(), status: z.enum(["pending", "accepted", "rejected"]), version: z.number().int(), createdAt: z.string(),
  birthYear: z.number().int().nullable().default(null), applicant: z.object({ id: z.number().int(), displayName: z.string() }).optional(),
});
export const bootstrapSchema = z.object({
  schemaVersion: z.union([z.literal(2), z.literal(3)]), actor: z.object({ id: z.number().int(), role: userRoleSchema }), staff: z.boolean(), permissions: z.array(z.string()).optional(),
  halls: z.array(z.object({ id: z.string(), name: z.string(), address: z.string(), active: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean).default(true) })), scopeVersion: z.string(), cursor: z.number().int(), currentMonth: monthSchema, serverTime: z.iso.datetime({ offset: true }),
});
const pageOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export const historySchema = z.object({ items: z.array(paymentSchema.extend({ confirmedBy: z.number().nullable(), confirmedAt: z.string().nullable(), updatedBy: z.number().nullable(), updatedAt: z.string().nullable() })), nextCursor: z.string().nullable(), currentMonth: monthSchema });
export const auditSchema = z.object({ items: z.array(z.object({ id: z.number(), studentId: z.string().nullable(), actorId: z.number().nullable(), action: z.string(), entityId: z.string(), details: z.record(z.string(), z.unknown()), createdAt: z.string() })), cursor: z.number(), hasMore: z.boolean() });
const devicesSchema = z.object({ items: z.array(z.object({ id: z.uuid(), label: z.string(), created_at: z.number(), expires_at: z.number(), revoked_at: z.number().nullable() })) });
const api = "https://api.mft39.ru/api/club/index.php";
const personalProfile = z.object({ firstName: z.string(), lastName: z.string(), middleName: z.string(), displayName: z.string(), version: z.number().int() });
const errors: Record<string, string> = {
  account_blocked: "Доступ к аккаунту ограничен. Свяжитесь с клубом.", permissions_changed: "Права доступа изменились. Обновите страницу и повторите проверку.",
  invalid_birth_year: "Укажите существующий год рождения.", student_archived: "Карточка находится в архиве. Сначала её необходимо восстановить.",
  migration_required: "Сервис ожидает обновления серверной части. Обратитесь к администратору клуба.", application_removed: "Связанная карточка удалена. Старая заявка не будет отправлена повторно.",
  version_conflict: "Данные уже изменились на сервере. Обновите карточку, проверьте изменения и повторите действие.",
  month_changed: "Начался новый месяц. Обновите данные и проверьте выбранный месяц оплаты.",
  duplicate_application: "Заявка на эту дату и в этот зал уже существует. Проверьте раздел «Мои тренировки».",
  idempotency_conflict: "Состав заявки изменился. Проверьте поля и отправьте её заново.",
  forbidden: "Для этого действия недостаточно прав.", not_found: "Запись недоступна или не найдена.",
  correction_reason_required: "Для исправления отметки или изменения прошлого месяца укажите причину.",
  admission_required: "Сначала тренер должен принять заявку ученика.",
  hall_change_requires_trainer: "Этот ученик уже связан с другим залом. Для перевода свяжитесь с тренером.",
  reactivation_requires_trainer: "Ученик неактивен. Сначала свяжитесь с тренером для возобновления занятий.",
  student_changed: "Данные ученика отличаются от серверной записи. Обновите список учеников.",
  device_limit: "Достигнут лимит активных доступов. Отзовите ненужный доступ.",
  rate_limited: "Слишком много запросов. Подождите несколько минут и повторите попытку.",
  legal_required: "Перед использованием кабинета подтвердите актуальные документы.",
  legal_documents_unavailable: "Юридические документы пока не утверждены. Подтверждение недоступно.",
  legal_migration_required: "Сервер ожидает обновления механизма согласий.",
  guardian_consent_required: "Для каждого ребёнка требуется отдельное согласие законного представителя.",
  legal_confirmation_required: "Подтвердите актуальную редакцию каждого обязательного документа отдельно.",
  consent_required: "Подтвердите согласие на обработку данных перед отправкой заявки.",
};
export class ClubError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(errors[code] ?? (status === 401 ? "Сессия завершилась. Войдите снова." : status === 422 ? "Проверьте заполнение полей." : "Сервис учёта временно недоступен. Повторите попытку позже.")); }
}
export async function request<T extends z.ZodType>(resource: string, schema: T, query: Record<string, string> = {}, body?: unknown, key?: string): Promise<z.output<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    let auth: Awaited<ReturnType<typeof fetchYandexSession>>;
    try { auth = await fetchYandexSession(); }
    catch (error) {
      if (error instanceof AccountBlockedError) { window.dispatchEvent(new Event("mft39:account-blocked")); throw new ClubError(403, "account_blocked"); }
      throw new ClubError(0, "unavailable");
    }
    const { session, csrfToken } = auth;
    if (!session || !csrfToken) { window.dispatchEvent(new Event("mft39:session-expired")); throw new ClubError(401, "unauthenticated"); }
    if (resource !== "legal-accept" && session.mode === "server" && session.legal?.required) { window.dispatchEvent(new Event("mft39:legal-required")); throw new ClubError(403,"legal_required"); }
    headers["Content-Type"] = "application/json"; headers["X-CSRF-Token"] = csrfToken;
    if (key) headers["Idempotency-Key"] = key;
  }
  let response: Response;
  try { response = await fetch(`${api}?${new URLSearchParams({ resource, ...query })}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) }); }
  catch { throw new ClubError(0, "unavailable"); }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("mft39:session-expired"));
    let code = "unavailable"; try { const error = await response.json(); if (typeof error.error === "string") code = error.error; } catch { /* Never echo raw server HTML. */ }
    if (code === "account_blocked") window.dispatchEvent(new Event("mft39:account-blocked"));
    if (code === "permissions_changed" || (response.status === 403 && code === "forbidden")) window.dispatchEvent(new Event("mft39:access-changed"));
    if (code === "legal_required" || code === "legal_documents_unavailable" || code === "legal_migration_required") window.dispatchEvent(new Event("mft39:legal-required"));
    throw new ClubError(response.status, code);
  }
  let json: unknown;
  try { json = await response.json(); } catch { throw new ClubError(502, "invalid_response"); }
  const result = schema.safeParse(json); if (!result.success) throw new ClubError(502, "invalid_response"); return result.data;
}
export type ClubBootstrap = z.infer<typeof bootstrapSchema>;
export type ClubStudent = z.infer<typeof studentSchema>;
export type ClubApplication = z.infer<typeof applicationSchema>;
export const clubApi = {
  bootstrap: () => request("bootstrap", bootstrapSchema),
  students: (status = "active", cursor = "", own = false, archived = false) => request("students", pageOf(studentSchema), { status, cursor, view: own ? "own" : "staff", archived: archived ? "1" : "0" }),
  student: (studentId: string) => request("student", studentSchema, { studentId }),
  applications: (cursor = "", status = "all", own = false) => request("applications", pageOf(applicationSchema), { cursor, status, view: own ? "own" : "staff" }),
  enroll: (body: TrainingBookingRequest, key: string) => request("applications", z.object({ batchId: z.uuid(), applicationIds: z.array(z.uuid()).min(1), replayed: z.boolean() }), {}, body, key),
  decide: (id: string, status: "accepted" | "rejected", expectedVersion: number) => request("application-decision", z.object({ id: z.uuid(), status: z.enum(["accepted", "rejected"]), version: z.number() }), {}, { id, status, expectedVersion }),
  status: (studentId: string, status: ClubStudent["status"], expectedVersion: number, reason: string) => request("student-status", z.object({ id: z.uuid(), status: z.enum(["trial", "permanent", "inactive"]), version: z.number() }), {}, { studentId, status, expectedVersion, reason }),
  payments: (studentId: string, cursor = "", own = false) => request("payments", historySchema, { studentId, cursor, view: own ? "own" : "staff" }),
  payment: (studentId: string, month: string, status: "paid" | "unpaid", expectedVersion: number, expectedCurrentMonth: string, reason: string) => request("payment", z.object({ studentId: z.uuid(), month: monthSchema, status: z.enum(["paid", "unpaid"]), version: z.number() }), {}, { studentId, month, status, expectedVersion, expectedCurrentMonth, reason }),
  audit: (studentId: string, after = 0, own = false) => request("changes", auditSchema, { studentId, after: String(after), view: own ? "own" : "staff" }),
  devices: () => request("devices", devicesSchema),
  createDevice: (label: string) => request("device-create", z.object({ id: z.uuid(), token: z.string(), expiresAt: z.number() }), {}, { label }),
  revokeDevice: (id: string) => request("device-revoke", z.object({ id: z.uuid(), revoked: z.boolean() }), {}, { id }),
  profile: () => request("profile", z.object({ profile: personalProfile })),
  saveProfile: (firstName: string, lastName: string, middleName: string, expectedVersion: number) => request("profile", z.object({ profile: personalProfile }), {}, { firstName, lastName, middleName, expectedVersion }),
  birthYear: (studentId: string, birthYear: number, expectedVersion: number) => request("student-birth-year", z.object({ student: studentSchema }), {}, { studentId, birthYear, expectedVersion }),
  archive: (studentId: string, expectedVersion: number, reason: string, restore = false) => request(restore ? "student-restore" : "student-archive", z.object({ student: studentSchema }), {}, { studentId, expectedVersion, reason }),
};
export function canClub(data: ClubBootstrap | null, permission: string): boolean {
  if (!data?.staff) return false;
  // Schema 2 remains a display-compatible fallback during a staged rollout;
  // new server-provided grants are authoritative as soon as schema 3 is live.
  if (data.schemaVersion === 3) return data.permissions?.includes(permission) ?? false;
  return ["applications.decide", "students.status", "payments.write"].includes(permission);
}
