import { describe, expect, it } from "vitest";
import { parseApiBaseUrl, backendStatus } from "../src/services/backend";

describe("Public backend configuration", () => {
  it("has an explicit disconnected state and accepts an empty address", () => {
    expect(parseApiBaseUrl("")).toBeNull();
    expect(backendStatus).toBe("not-connected");
  });
  it("accepts an HTTPS address without embedding credentials or query data", () => {
    expect(parseApiBaseUrl("https://api.example.ru/v1/")).toBe("https://api.example.ru/v1");
    for (const input of ["http://api.example.ru", "https://user:password@api.example.ru", "https://api.example.ru/?token=x", "javascript:alert(1)"]) {
      expect(() => parseApiBaseUrl(input)).toThrow();
    }
  });
});
