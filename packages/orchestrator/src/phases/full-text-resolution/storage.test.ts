import { describe, expect, it, vi, beforeEach } from "vitest";
import { S3ObjectStore, storageKey } from "./storage.js";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

describe("S3ObjectStore", () => {
  beforeEach(() => {
    send.mockReset();
  });

  const s3 = {
    endpoint: "http://localhost:9000",
    bucket: "research-vault",
    accessKey: "minioadmin",
    secretKey: "minioadmin",
    region: "us-east-1",
  };

  it("puts and reads bytes via the S3 client", async () => {
    const store = new S3ObjectStore(s3);
    const key = storageKey("10.1/x", "paper-1");
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

    send.mockResolvedValueOnce({});
    const pointer = await store.put(key, bytes, "application/pdf");
    expect(pointer).toBe("s3://research-vault/raw_pdfs/10.1_x.pdf");
    expect(send).toHaveBeenCalledTimes(1);

    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => bytes },
    });
    const roundTrip = await store.get(key);
    expect(roundTrip).toEqual(bytes);
  });

  it("reports existence via HeadObject", async () => {
    const store = new S3ObjectStore(s3);
    send.mockResolvedValueOnce({});
    expect(await store.exists("raw_pdfs/test.pdf")).toBe(true);

    send.mockRejectedValueOnce(new Error("not found"));
    expect(await store.exists("missing.pdf")).toBe(false);
  });
});
