import { describe, expect, it } from "vitest";
import { hasPdfMagic, isHtmlContentType } from "./sanitize.js";

describe("hasPdfMagic", () => {
  it("accepts a %PDF- header", () => {
    expect(hasPdfMagic(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true);
  });
  it("rejects non-PDF bytes and short buffers", () => {
    expect(hasPdfMagic(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBe(false);
    expect(hasPdfMagic(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});

describe("isHtmlContentType", () => {
  it("detects html (paywall login pages)", () => {
    expect(isHtmlContentType("text/html; charset=utf-8")).toBe(true);
    expect(isHtmlContentType("application/pdf")).toBe(false);
    expect(isHtmlContentType(null)).toBe(false);
  });
});
