export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  retries = 3,
  backoffMs = 300,
): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt === retries) break;
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    attempt += 1;
  }
  throw lastError ?? new Error("Unknown fetch error");
}
