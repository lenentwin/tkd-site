import { describe, expect, it, vi } from "vitest";
import { defaultContent } from "../src/content/site.content";
import { parseContent } from "../src/types/content";
import {
  getGmailLink,
  getMapLink,
  getYandexEmbed,
  getRutubeEmbed,
} from "../src/services/integrations";
import { demoBookingService, DEMO_BOOKING_MESSAGE } from "../src/services/demo";

describe("Configuration import boundary", () => {
  it("accepts the supplied facts and preserves the complete section model", () => {
    const value = parseContent(defaultContent);
    expect(value.sections).toHaveLength(9);
    expect(value.locations).toHaveLength(3);
    expect(value.events).toHaveLength(7);
    expect(value.medals.gold + value.medals.silver + value.medals.bronze).toBe(
      182,
    );
  });
  it("rejects missing versions, duplicate sections and unbounded motion settings", () => {
    expect(() => parseContent({ ...defaultContent, version: 2 })).toThrow();
    const duplicate = structuredClone(defaultContent);
    duplicate.sections[1].id = duplicate.sections[0].id;
    expect(() => parseContent(duplicate)).toThrow("уникальными");
    expect(() =>
      parseContent({
        ...defaultContent,
        motion: { ...defaultContent.motion, introDuration: 50 },
      }),
    ).toThrow();
  });
  it("rejects executable media/links, embedded base64 and prohibited purple accents", () => {
    const next = structuredClone(defaultContent);
    next.media[0].src = "javascript:alert(1)";
    expect(() => parseContent(next)).toThrow();
    next.media[0].src = "data:image/png;base64,AAAA";
    expect(() => parseContent(next)).toThrow();
    expect(() =>
      parseContent({
        ...defaultContent,
        contacts: { ...defaultContent.contacts, vkUrl: "javascript:alert(1)" },
      }),
    ).toThrow();
    expect(() =>
      parseContent({
        ...defaultContent,
        theme: { ...defaultContent.theme, accent: "#9900ff" },
      }),
    ).toThrow("Фиолетовые");
  });
});

describe("External integration fallbacks", () => {
  it("embeds each supplied hall using its own official Yandex share token", () => {
    const tokens = ["CXCNaB8Z", "CXCNaKYV", "CXCNa0zI"];
    expect(defaultContent.locations.map(getYandexEmbed)).toEqual(
      tokens.map(
        (token) => `https://api-maps.yandex.ru/frame/v1/-/${token}?lang=ru_RU`,
      ),
    );
  });
  it("rejects untrusted map origins and unsupported embed paths", () => {
    for (const yandexUrl of [
      "https://yandex.ru.evil.example/maps/-/CXCNaB8Z",
      "http://yandex.ru/maps/-/CXCNaB8Z",
      "https://yandex.ru/maps/-/CXCNaB8Z/extra",
      "https://yandex.ru/maps/",
    ]) {
      expect(
        getYandexEmbed({ ...defaultContent.locations[0], yandexUrl }),
      ).toBeNull();
    }
  });
  it("keeps supplied Yandex links and never invents a missing 2GIS route", () => {
    expect(getMapLink(defaultContent.locations[0], "yandex")).toBe(
      "https://yandex.ru/maps/-/CXCNaB8Z",
    );
    expect(getMapLink(defaultContent.locations[0], "2gis")).toBeNull();
    expect(
      getMapLink(
        {
          ...defaultContent.locations[0],
          yandexUrl: "https://evil.example/yandex.ru",
        },
        "yandex",
      ),
    ).toBeNull();
  });
  it("embeds only an explicit Rutube video on the official host", () => {
    const id = "1234567890abcdef1234567890abcdef";
    expect(getRutubeEmbed(`https://rutube.ru/video/${id}/`)).toBe(
      `https://rutube.ru/play/embed/${id}/`,
    );
    expect(getRutubeEmbed(`https://rutube.ru/play/embed/${id}/`)).toBe(
      `https://rutube.ru/play/embed/${id}/`,
    );
    expect(getRutubeEmbed("https://rutube.ru/channel/55532225/")).toBeNull();
    expect(
      getRutubeEmbed(`https://rutube.ru.evil.example/video/${id}/`),
    ).toBeNull();
    expect(getRutubeEmbed("")).toBeNull();
  });
  it("encodes the Gmail recipient without adding extra query parameters", () => {
    const url = new URL(getGmailLink("test+club@example.com"));
    expect(url.searchParams.get("to")).toBe("test+club@example.com");
    expect(url.searchParams.get("view")).toBe("cm");
  });
});

describe("Demo booking boundary", () => {
  it("returns an honest demo result without a network call", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    try {
      const response = await demoBookingService.submit({
        locationId: "chelnokova",
        participantType: "child",
        fullName: "Тестовый Ребёнок",
        birthDate: "2018-01-01",
        requestedDate: "2026-12-01",
      });
      expect(response).toEqual({
        status: "demo-only",
        message: DEMO_BOOKING_MESSAGE,
      });
      expect(network).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
