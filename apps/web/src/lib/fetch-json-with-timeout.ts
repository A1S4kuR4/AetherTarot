export type FetchJsonWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
  timeoutMessage?: string;
};

export async function fetchJsonWithTimeout<TPayload = unknown>(
  input: RequestInfo | URL,
  options: FetchJsonWithTimeoutOptions = {},
) {
  const {
    timeoutMs = 45_000,
    timeoutMessage = "请求等待超时，请稍后重试。",
    signal,
    ...requestInit
  } = options;
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  const abortFromParent = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    abortFromParent();
  } else {
    signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    const response = await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
    const payload = (await response.json()) as TPayload;

    return { response, payload };
  } catch (error) {
    if (didTimeout) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
