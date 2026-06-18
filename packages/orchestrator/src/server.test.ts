import { describe, expect, it } from "vitest";
import { InMemoryObjectStore } from "./phases/full-text-resolution/index.js";
import { buildServer } from "./server.js";

const noAuth = { orchestrator: { apiKey: null } as const };

describe("orchestrator API", () => {
  it("reports health without auth", async () => {
    const app = buildServer({ orchestrator: { apiKey: "secret" } });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("requires auth on non-health routes when API key is configured", async () => {
    const app = buildServer({ orchestrator: { apiKey: "secret" } });
    const res = await app.inject({ method: "POST", url: "/research", payload: { query: "test query here" } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("accepts bearer token auth", async () => {
    const app = buildServer({ orchestrator: { apiKey: "secret", maxConcurrentJobs: 10 } });
    const res = await app.inject({
      method: "POST",
      url: "/research",
      headers: { authorization: "Bearer secret" },
      payload: { query: "machine learning interpretability research" },
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it("rejects a research request with no query", async () => {
    const app = buildServer(noAuth);
    const res = await app.inject({ method: "POST", url: "/research", payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects an oversized PDF upload", async () => {
    const app = buildServer({
      ...noAuth,
      store: new InMemoryObjectStore(),
      orchestrator: { maxUploadBytes: 32 },
    });
    const pdfBase64 = Buffer.from(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x0a])).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: { doi: null, internalId: "p1", pdfBase64 },
    });
    expect(res.statusCode).toBe(413);
    await app.close();
  });

  it("stores a valid PDF upload in the vault", async () => {
    const store = new InMemoryObjectStore();
    const app = buildServer({ ...noAuth, store });
    const pdfBase64 = Buffer.from(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: { doi: "10.1/x", internalId: "p1", pdfBase64 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stored).toBe(true);
    await app.close();
  });

  it("rejects a non-PDF upload", async () => {
    const app = buildServer({ ...noAuth, store: new InMemoryObjectStore() });
    const pdfBase64 = Buffer.from("just text").toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: { doi: null, internalId: "p1", pdfBase64 },
    });
    expect(res.statusCode).toBe(415);
    await app.close();
  });
});
