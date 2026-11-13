import { describe, expect, it } from "vitest";
import { localToday, trainingBookingSchema } from "../src/types/trainingBooking";
const schema = trainingBookingSchema(["hall-a", "hall-b"], "2026-11-13");
const adult = { lastName: "Проверкин", firstName: "Тест", middleName: "", age: "28" };
const guardian = { lastName: "Проверкин", firstName: "Тест", middleName: "", phone: "+7 (000) 000-00-00", relationship: "parent" };
const draft = { students: [adult], locationId: "hall-a", requestedDate: "2026-11-14", consent: true, consentVersion: "club-2026-11-13" };
describe("Future training booking contract", () => {
  it("requires explicit current-version consent before any submission", () => {
    for (const consent of [false, undefined, "true", 1]) expect(schema.safeParse({ ...draft, consent }).success).toBe(false);
    expect(schema.safeParse({ ...draft, consentVersion: "old-version" }).success).toBe(false);
  });
  it("separates applicant from students and accepts adults without guardian", () => {
    const result = schema.parse(draft);
    expect(result.students[0].age).toBe(28);
    expect(result.guardian).toBeUndefined();
    expect(result).not.toHaveProperty("yandex_user_id");
  });
  it("requires guardian for any minor including a mixed group", () => {
    const value = { ...draft, students: [adult, { ...adult, firstName: "Пример", age: "9" }] };
    expect(schema.safeParse(value).success).toBe(false);
    expect(schema.parse({ ...value, guardian }).students).toHaveLength(2);
  });
  it("does not require middle names and supports hyphenated/unicode names", () => {
    expect(schema.safeParse({ ...draft, students: [{ ...adult, lastName: "Тест-Пример", firstName: "Ли" }] }).success).toBe(true);
  });
  it("rejects empty names, punctuation-only names and invalid ages", () => {
    for (const age of ["", "0", "121", "-1", "3.5", "1e1"]) {
      expect(schema.safeParse({ ...draft, students: [{ ...adult, age }] }).success).toBe(false);
    }
    for (const lastName of ["", "  ", "----", "123", "<script>"]) {
      expect(schema.safeParse({ ...draft, students: [{ ...adult, lastName }] }).success).toBe(false);
    }
  });
  it("rejects stale/invalid dates and unknown halls", () => {
    for (const requestedDate of ["", "2026-11-12", "2027-02-31", "2026-13-01"]) {
      expect(schema.safeParse({ ...draft, requestedDate }).success).toBe(false);
    }
    expect(schema.safeParse({ ...draft, locationId: "invented" }).success).toBe(false);
    expect(schema.safeParse({ ...draft, requestedDate: "2026-11-13" }).success).toBe(true);
  });
  it("validates guardian contact and relation", () => {
    const value = { ...draft, students: [{ ...adult, age: "12" }] };
    expect(schema.safeParse({ ...value, guardian: { ...guardian, phone: "123" } }).success).toBe(false);
    expect(schema.safeParse({ ...value, guardian: { ...guardian, relationship: "stranger" } }).success).toBe(false);
  });
  it("uses the club calendar consistently with backend validation", () => {
    expect(localToday(new Date(2026, 0, 2, 1))).toBe("2026-01-02");
    expect(localToday(new Date("2026-12-31T22:00:00Z"))).toBe("2027-01-01");
  });
});
