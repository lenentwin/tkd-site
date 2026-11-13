import { z } from "zod";
import { fetchYandexSession } from "./yandexAuth";
import type { TrainingBookingRequest } from "../types/trainingBooking";

export const userRoleSchema = z.enum(["user", "trainer", "head_trainer", "admin"]);
export const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const paymentSchema = z.object({ month: monthSchema, status: z.enum(["paid", "unpaid"]), version: z.number().int().nonnegative() });
export const studentSchema = z.object({
  id: z.uuid(), locationId: z.string(), lastName: z.string(), firstName: z.string(), middleName: z.string(), age: z.number().int(),
  ageRecordedOn: z.string(), status: z.enum(["trial", "permanent", "inactive"]), admitted: z.boolean(), createdAt: z.string(), version: z.number().int(), payment: paymentSchema,
});
const guardian = z.object({ lastName: z.string(), firstName: z.string(), middleName: z.string(), phone: z.string(), relationship: z.enum(["parent", "guardian"]) });
export const applicationSchema = z.object({
  id: z.uuid(), studentId: z.uuid(), locationId: z.string(), lastName: z.string(), firstName: z.string(), middleName: z.string(), age: z.number().int(),
  requestedDate: z.string(), comment: z.string(), guardian: guardian.nullable(), status: z.enum(["pending", "accepted", "rejected"]), version: z.number().int(), createdAt: z.string(),
});
export const bootstrapSchema = z.object({
  schemaVersion: z.literal(2), actor: z.object({ id: z.number().int(), role: userRoleSchema }), staff: z.boolean(),
  halls: z.array(z.object({ id: z.string(), name: z.string(), address: z.string() })), scopeVersion: z.string(), cursor: z.number().int(), currentMonth: monthSchema, serverTime: z.iso.datetime({ offset: true }),
});
const pageOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export const historySchema = z.object({ items: z.array(paymentSchema.extend({ confirmedBy: z.number().nullable(), confirmedAt: z.string().nullable(), updatedBy: z.number().nullable(), updatedAt: z.string().nullable() })), nextCursor: z.string().nullable(), currentMonth: monthSchema });
export const auditSchema = z.object({ items: z.array(z.object({ id: z.number(), studentId: z.string().nullable(), actorId: z.number().nullable(), action: z.string(), entityId: z.string(), details: z.record(z.string(), z.unknown()), createdAt: z.string() })), cursor: z.number(), hasMore: z.boolean() });
const devicesSchema = z.object({ items: z.array(z.object({ id: z.uuid(), label: z.string(), created_at: z.number(), expires_at: z.number(), revoked_at: z.number().nullable() })) });
const api = "https://api.mft39.ru/api/club/index.php";
const errors: Record<string, string> = {
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
};
export class ClubError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(errors[code] ?? (status === 401 ? "Сессия завершилась. Войдите снова." : status === 422 ? "Проверьте заполнение полей." : "Сервис учёта временно недоступен. Повторите попытку позже.")); }
}
async function request<T extends z.ZodType>(resource: string, schema: T, query: Record<string, string> = {}, body?: unknown, key?: string): Promise<z.output<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    const { session, csrfToken } = await fetchYandexSession();
    if (!session || !csrfToken) { window.dispatchEvent(new Event("mft39:session-expired")); throw new ClubError(401, "unauthenticated"); }
    headers["Content-Type"] = "application/json"; headers["X-CSRF-Token"] = csrfToken;
    if (key) headers["Idempotency-Key"] = key;
  }
  let response: Response;
  try { response = await fetch(`${api}?${new URLSearchParams({ resource, ...query })}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) }); }
  catch { throw new ClubError(0, "unavailable"); }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("mft39:session-expired"));
    let code = "unavailable"; try { const error = await response.json(); if (typeof error.error === "string") code = error.error; } catch { /* Never echo raw server HTML. */ }
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
  students: (status = "active", cursor = "", own = false) => request("students", pageOf(studentSchema), { status, cursor, view: own ? "own" : "staff" }),
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
};
