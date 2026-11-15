import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import LegalMarkdown, { safeLegalHref } from "../src/pages/legal/LegalMarkdown";
import { legalApi, legalStateSchema, matchingApprovedDocument, pendingAccountDocuments, type LegalDocument, type LegalState } from "../src/services/legal";

const hash = "a".repeat(64);
const document = (type: LegalDocument["type"], status: "draft" | "approved" = "approved"): LegalDocument => ({ type, title: type, version: "2026-11-15.1", hash, status, content: "# Title\n\nFull text" });
const state = (): LegalState => ({ ok: true, documents: [document("terms"), document("privacy"), document("user_consent"), document("guardian_consent")], enforcement: true, required: true, accepted: [], canAccept: true });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => vi.unstubAllGlobals());

describe("Legal document version contract", () => {
  it("requires explicit server approval metadata and valid content hashes", () => {
    expect(legalStateSchema.safeParse(state()).success).toBe(true);
    expect(legalStateSchema.safeParse({ ...state(), documents: [{ ...document("terms"), hash: "bad" }] }).success).toBe(false);
    expect(legalStateSchema.safeParse({ ...state(), canAccept: undefined }).success).toBe(false);
  });
  it("asks again only for account documents whose current version has not been accepted", () => {
    const value = state();
    value.accepted = [{ type: "terms", version: document("terms").version, hash, confirmedAt: "2026-11-15T10:00:00Z" }, { type: "user_consent", version: "old", hash, confirmedAt: "2026-11-14T10:00:00Z" }];
    expect(pendingAccountDocuments(value).map((item) => item.type)).toEqual(["user_consent"]);
    value.accepted.push({ type: "user_consent", version: document("user_consent").version, hash, confirmedAt: "2026-11-15T10:01:00Z" });
    expect(pendingAccountDocuments(value)).toEqual([]);
    value.accepted[0].hash = "b".repeat(64);
    expect(pendingAccountDocuments(value).map((item) => item.type)).toEqual(["terms"]);
  });
  it("never permits drafts, a stale bundle, or a different hash as the approved text", () => {
    const current = document("terms");
    expect(matchingApprovedDocument(current, [current])).toBe(current);
    expect(matchingApprovedDocument(document("terms", "draft"), [current])).toBeUndefined();
    expect(matchingApprovedDocument(current, [document("terms", "draft")])).toBeUndefined();
    expect(matchingApprovedDocument(current, [{ ...current, version: "old" }])).toBeUndefined();
    expect(matchingApprovedDocument(current, [{ ...current, hash: "b".repeat(64) }])).toBeUndefined();
  });
  it("accepts exact versions through the shared cookie and CSRF transport", async () => {
    const csrf = "x".repeat(43);
    const fetch = vi.fn().mockResolvedValueOnce(json({ authenticated: true, user: { id: 1, role: "user" }, csrfToken: csrf })).mockResolvedValueOnce(json({ ...state(), required: false }));
    vi.stubGlobal("fetch", fetch);
    const documents = [{ type: "terms" as const, version: "2026-11-15.1", hash, accepted: true as const }];
    await expect(legalApi.accept(documents)).resolves.toMatchObject({ required: false });
    expect(fetch.mock.calls[1][0]).toContain("resource=legal-accept");
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: "include", method: "POST", cache: "no-store", headers: { "X-CSRF-Token": csrf } });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ documents });
  });
  it("does not report a malformed or interrupted legal response as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true })).mockRejectedValueOnce(new Error("offline")));
    await expect(legalApi.state()).rejects.toMatchObject({ code: "invalid_response" });
    await expect(legalApi.state()).rejects.toMatchObject({ status: 0 });
  });
});

describe("Safe complete legal rendering", () => {
  it("renders headings, paragraphs, bullet and ordered lists without dropping text", () => {
    const html = renderToStaticMarkup(createElement(LegalMarkdown, { content: "# Заголовок\n\n## Раздел\n\nАбзац **важный**.\nВторая строка.\n\n- Первый\n- Второй\n\n1. Действие\n2. Результат" }));
    expect(html).toContain("<h1>Заголовок</h1>"); expect(html).toContain("<h2>Раздел</h2>");
    expect(html).toContain("<strong>важный</strong>"); expect(html).toContain("Вторая строка.");
    expect(html).toContain("<ul><li>Первый</li><li>Второй</li></ul>"); expect(html).toContain("<ol start=\"1\"><li>Действие</li><li>Результат</li></ol>");
  });
  it("escapes raw HTML and disallows executable and non-HTTPS links", () => {
    const html = renderToStaticMarkup(createElement(LegalMarkdown, { content: '<script>alert(1)</script>\n\n[опасно](javascript:alert) [данные](data:text/html,bad) [HTTP](http://example.com) [сайт](https://mft39.ru) [почта](mailto:tkdmft39@mail.ru)' }));
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript:'); expect(html).not.toContain('href="data:'); expect(html).not.toContain('href="http:');
    expect(html).toContain('href="https://mft39.ru/"'); expect(html).toContain('href="mailto:tkdmft39@mail.ru"');
    expect(safeLegalHref(" javascript:alert(1)")).toBeUndefined(); expect(safeLegalHref("//example.com")).toBeUndefined();
  });
});

const auth = vi.hoisted(() => ({ session: null as unknown, loading: false, unavailable: false, blocked: false, refresh: vi.fn(), signOut: vi.fn() }));
vi.mock("../src/app/providers/AuthProvider", () => ({ useAuth: () => auth }));
import LegalGate from "../src/pages/legal/LegalGate";

describe("Legal gate before private page mount", () => {
  const serverSession = { mode: "server", id: 1, displayName: "Test", role: "user" };
  function renderGate() {
    const privateRender = vi.fn(() => createElement("p", null, "Private content"));
    renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LegalGate, { children: createElement(privateRender) })));
    return privateRender;
  }
  it("keeps private children unmounted while consent is required", () => {
    auth.session = { ...serverSession, legal: { required: true, enforcement: true, canAccept: true } }; auth.loading = false; auth.unavailable = false;
    expect(renderGate()).not.toHaveBeenCalled();
  });
  it("keeps private children unmounted when authentication is pending or unavailable", () => {
    auth.session = serverSession; auth.loading = true;
    expect(renderGate()).not.toHaveBeenCalled(); auth.loading = false; auth.unavailable = true;
    expect(renderGate()).not.toHaveBeenCalled(); auth.unavailable = false;
  });
  it("preserves legacy sessions and sessions with completed legal requirements", () => {
    auth.session = serverSession;
    expect(renderGate()).toHaveBeenCalledOnce();
    auth.session = { ...serverSession, legal: { required: false, enforcement: true, canAccept: true } };
    expect(renderGate()).toHaveBeenCalledOnce();
  });
});
