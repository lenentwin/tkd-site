import { z } from "zod";

const personName = z.string().trim().min(1, "Заполните поле").max(80, "Не больше 80 символов")
  .regex(/^[\p{L}\p{M} .’'-]+$/u, "Используйте буквы, пробел, дефис или апостроф")
  .refine(value => /\p{L}/u.test(value), "Укажите имя или фамилию буквами");
const optionalName = z.string().trim().max(80, "Не больше 80 символов")
  .refine(value => value === "" || (/^[\p{L}\p{M} .’'-]+$/u.test(value) && /\p{L}/u.test(value)), "Проверьте отчество");
const studentSchema = z.object({
  id: z.uuid().optional(),
  lastName: personName, firstName: personName, middleName: optionalName,
  age: z.string().regex(/^\d{1,3}$/, "Укажите возраст в полных годах")
    .transform(Number).pipe(z.number().int().min(1, "Укажите возраст от 1 до 120 лет").max(120, "Укажите возраст от 1 до 120 лет")),
});
const guardianSchema = z.object({
  lastName: personName, firstName: personName, middleName: optionalName,
  relationship: z.enum(["parent", "guardian"], { error: "Выберите, кем вы приходитесь ученику" }),
  phone: z.string().trim().refine(value => /^[+\d ()-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, "")), "Укажите телефон: от 10 до 15 цифр"),
});
export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function trainingBookingSchema(locationIds: readonly string[], today = localToday()) {
  return z.object({
    students: z.array(studentSchema).min(1, "Добавьте ученика").max(20, "В одной заявке не больше 20 учеников"),
    locationId: z.string().refine(id => locationIds.includes(id), "Выберите спортивный зал"),
    requestedDate: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value >= today, "Выберите существующую дату не раньше сегодняшней"),
    guardian: guardianSchema.optional(),
    comment: z.string().trim().max(1000, "Не больше 1000 символов").optional(),
  }).superRefine((value, context) => {
    if (value.students.some(student => student.age < 18) && !value.guardian) {
      context.addIssue({ code: "custom", path: ["guardian"], message: "Для несовершеннолетнего укажите родителя или законного представителя" });
    }
  });
}
/** Applicant account and students are separate people. Sent only to the Russian API. */
export type TrainingBookingRequest = z.output<ReturnType<typeof trainingBookingSchema>>;
