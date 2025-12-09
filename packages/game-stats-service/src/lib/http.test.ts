import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./http";

describe("fetchWithRetry", () => {
  it("retries and succeeds", async () => {
    const fakeResponse = new Response("{}" as BodyInit, { status: 200 });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValue(fakeResponse);

    (global as any).fetch = fetchMock;

    const res = await fetchWithRetry("http://example.com", {}, 3, 10);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails after retries exhausted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("fail"));
    (global as any).fetch = fetchMock;

    await expect(fetchWithRetry("http://example.com", {}, 2, 5)).rejects.toThrow("fail");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
