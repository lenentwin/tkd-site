import { describe, expect, it, vi, afterEach } from "vitest";
import { AccountBlockedError, fetchYandexSession } from "../src/services/yandexAuth";
import { bootstrapSchema, canClub, clubApi } from "../src/services/club";
import { trainingBookingSchema } from "../src/types/trainingBooking";
afterEach(() => vi.unstubAllGlobals());
describe("Administrative and profile security contract", () => {
  it("immediately closes a blocked session before sending a profile mutation", async () => {
    const dispatchEvent=vi.fn();vi.stubGlobal("window",{dispatchEvent});
    const request=vi.fn().mockResolvedValue(new Response('{"error":"account_blocked"}',{status:403}));vi.stubGlobal("fetch",request);
    await expect(clubApi.saveProfile("Имя","Фамилия","",1)).rejects.toMatchObject({status:403,code:"account_blocked"});
    expect(request).toHaveBeenCalledOnce();expect(dispatchEvent.mock.calls[0][0].type).toBe("mft39:account-blocked");
  });
  it("uses server deny/grant lists for schema 3, including missing permissions", () => {
    const base = { schemaVersion: 3, actor: { id: 7, role: "trainer" }, staff: true, halls: [], scopeVersion: "new", cursor: 0, currentMonth: "2026-11", serverTime: "2026-11-15T12:00:00Z" };
    expect(canClub(bootstrapSchema.parse(base), "payments.write")).toBe(false);
    expect(canClub(bootstrapSchema.parse({ ...base, permissions: ["students.archive"] }), "students.archive")).toBe(true);
    expect(canClub(bootstrapSchema.parse({ ...base, permissions: ["students.archive"] }), "payments.write")).toBe(false);
    expect(canClub(null, "payments.write")).toBe(false);
  });
  it("keeps Yandex names in the in-memory profile and reports a blocked account separately", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true, user: { id: 4, role: "user", firstName: "Имя", lastName: "Родитель", middleName: "", displayName: "Родитель Имя", version: 5 }, csrfToken: "x".repeat(43) }))));
    expect((await fetchYandexSession()).session).toMatchObject({ displayName: "Родитель Имя", firstName: "Имя", profileVersion: 5 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"account_blocked"}', { status: 403 })));
    await expect(fetchYandexSession()).rejects.toBeInstanceOf(AccountBlockedError);
  });
  it("requires family consent in the calendar year of the 18th birthday", () => {
    const schema=trainingBookingSchema(["city"],"2026-11-15");
    expect(schema.safeParse({ students:[{ lastName:"Тест",firstName:"Пример",middleName:"",birthYear:"2008" }],locationId:"city",requestedDate:"2026-11-20",consent:true,consentVersion:"club-2026-11-13" }).success).toBe(false);
  });
  it("sends only the editable name fields with CSRF and an optimistic version", async () => {
    const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ authenticated:true,user:{id:4,role:"user"},csrfToken:"x".repeat(43) }))).mockResolvedValueOnce(new Response(JSON.stringify({profile:{firstName:"Новое",lastName:"Имя",middleName:"",displayName:"Имя Новое",version:3}})));
    vi.stubGlobal("fetch",request);
    await clubApi.saveProfile("Новое","Имя","",2);
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({firstName:"Новое",lastName:"Имя",middleName:"",expectedVersion:2});
    expect(request.mock.calls[1][1]).toMatchObject({credentials:"include",cache:"no-store",headers:{"X-CSRF-Token":"x".repeat(43)}});
  });
});
