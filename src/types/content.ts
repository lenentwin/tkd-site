import { z } from "zod";

const text = z.string().max(12000);
const shortText = z.string().max(400);
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[\w-]+$/,
    "Используйте латинские буквы, цифры, дефис или подчёркивание",
  );
const webUrl = z.string().refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Нужна ссылка https:// или пустое значение");
const mediaPath = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      !value ||
      /^\/(?!\/)/.test(value) ||
      /^https:\/\//.test(value) ||
      /^idb:[\w-]+$/.test(value),
    "Укажите /images/…, https://… или выберите локальный файл",
  );
const color = z
  .string()
  .regex(/^#[\da-f]{6}$/i, "Цвет в формате #RRGGBB")
  .refine((value) => {
    const [r, g, b] = [1, 3, 5].map(
      (index) => parseInt(value.slice(index, index + 2), 16) / 255,
    );
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min;
    if (delta < 0.03) return true;
    const hue =
      ((max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) *
        60 +
        360) %
      360;
    return hue < 250 || hue > 315;
  }, "Фиолетовые оттенки запрещены художественной системой проекта");
export const sectionIdSchema = z.enum([
  "hero",
  "locations",
  "map",
  "coach",
  "achievements",
  "gallery",
  "rutube",
  "reviews",
  "contacts",
]);
export const mediaSchema = z.object({
  id,
  src: mediaPath,
  title: shortText,
  alt: shortText,
  category: shortText,
  aspectRatio: z.enum(["1:1", "1:2"]),
  focalPoint: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  order: z.number().int().min(0).max(10000),
  visible: z.boolean(),
  usage: z.enum(["hero", "gallery", "coach"]),
  eventId: z.string().max(100).optional(),
});
export const locationSchema = z.object({
  id,
  name: shortText,
  address: shortText,
  hours: text,
  schedule: text,
  yandexUrl: webUrl,
  twoGisUrl: webUrl,
});
export const coachSchema = z.object({
  id,
  name: shortText,
  role: shortText,
  qualifications: z.array(shortText).max(30),
  experience: shortText,
  bio: text,
  mediaId: z.string().max(100),
});
export const eventSchema = z.object({
  id,
  year: shortText,
  title: shortText,
  description: text,
  mediaId: z.string().max(100).optional(),
});
export const reviewSchema = z.object({
  id,
  author: shortText,
  quote: text,
  originalUrl: webUrl,
  confirmed: z.boolean(),
});
export const pageMetaSchema = z.object({ title: shortText, description: text });
export const contentSchema = z
  .object({
    version: z.literal(1),
    brand: z.object({
      shortName: shortText,
      fullName: shortText,
      motto: shortText,
      description: text,
      bookingLabel: shortText,
    }),
    sections: z
      .array(
        z.object({
          id: sectionIdSchema,
          title: shortText,
          intro: text,
          enabled: z.boolean(),
        }),
      )
      .length(9),
    locations: z.array(locationSchema).min(1).max(30),
    ageGroups: z.array(shortText).max(12),
    discounts: z
      .array(
        z.object({
          id,
          title: shortText,
          percent: z.number().min(0).max(100),
          details: text,
        }),
      )
      .max(20),
    coaches: z.array(coachSchema).min(1).max(30),
    medals: z.object({
      gold: z.number().int().min(0).max(999999),
      silver: z.number().int().min(0).max(999999),
      bronze: z.number().int().min(0).max(999999),
      note: text,
    }),
    events: z.array(eventSchema).max(200),
    media: z.array(mediaSchema).max(200),
    video: z.object({
      channelName: shortText,
      channelUrl: webUrl,
      videoUrl: webUrl,
      description: text,
      posterMediaId: z.string().max(100),
    }),
    reviews: z.array(reviewSchema).max(200),
    contacts: z.object({
      phone: z.string().max(60),
      email: z.email(),
      vkUrl: webUrl,
      rutubeUrl: webUrl,
    }),
    theme: z.object({
      defaultMode: z.enum(["dark", "light"]),
      accent: color,
      secondaryAccent: color,
      gridOpacity: z.number().min(0).max(0.3),
    }),
    motion: z.object({
      enabled: z.boolean(),
      introDuration: z.number().min(2.8).max(3.2),
      transitionDuration: z.number().min(0.15).max(0.8),
      rotateSpeed: z.number().min(0).max(0.12),
      inertia: z.number().min(0.8).max(0.99),
      tilt: z.number().min(0).max(12),
      radius: z.number().min(180).max(600),
    }),
    pages: z.record(z.string(), pageMetaSchema),
  })
  .superRefine((data, ctx) => {
    const checkIds = (items: { id: string }[], path: string) => {
      if (new Set(items.map((item) => item.id)).size !== items.length)
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: "Идентификаторы должны быть уникальными",
        });
    };
    checkIds(data.sections, "sections");
    for (const key of [
      "locations",
      "coaches",
      "events",
      "media",
      "reviews",
      "discounts",
    ] as const)
      checkIds(data[key], key);
  });

export type SiteContent = z.infer<typeof contentSchema>;
export type MediaItem = z.infer<typeof mediaSchema>;
export type LocationItem = z.infer<typeof locationSchema>;
export type CoachItem = z.infer<typeof coachSchema>;
export type EventItem = z.infer<typeof eventSchema>;
export type ReviewItem = z.infer<typeof reviewSchema>;
export type SectionId = z.infer<typeof sectionIdSchema>;
export type ThemeMode = "dark" | "light";

export function parseContent(value: unknown): SiteContent {
  const result = contentSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  return result.data;
}
