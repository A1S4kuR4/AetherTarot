import { ReadingGenerationError } from "@/server/reading/errors";

export type ProviderBulkheadConfig = {
  maxConcurrent: number;
  maxQueued: number;
  queueTimeoutMs: number;
};

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
};

export class ProviderBulkhead {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(private readonly config: ProviderBulkheadConfig) {}

  get stats() {
    return { active: this.active, queued: this.queue.length };
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw this.cancelled();
    if (this.active < this.config.maxConcurrent) {
      this.active += 1;
      return this.createRelease();
    }
    if (this.queue.length >= this.config.maxQueued) {
      throw new ReadingGenerationError({
        subtype: "queue_full",
        message: "模型请求队列已满，请稍后重试。",
        code: "provider_unavailable",
        status: 503,
        retryable: true,
        details: { retry_after_seconds: Math.max(1, Math.ceil(this.config.queueTimeoutMs / 1000)) },
      });
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        timer: setTimeout(() => {
          this.remove(waiter);
          reject(new ReadingGenerationError({
            subtype: "queue_timeout",
            message: "模型请求排队超时，请稍后重试。",
            code: "provider_unavailable",
            status: 503,
            retryable: true,
            details: { retry_after_seconds: Math.max(1, Math.ceil(this.config.queueTimeoutMs / 1000)) },
          }));
        }, this.config.queueTimeoutMs),
      };
      waiter.onAbort = () => {
        this.remove(waiter);
        reject(this.cancelled());
      };
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
      this.queue.push(waiter);
    });
  }

  private cancelled() {
    return new ReadingGenerationError({
      subtype: "cancelled",
      message: "Reading 请求已取消。",
      retryable: false,
    });
  }

  private remove(waiter: Waiter) {
    const index = this.queue.indexOf(waiter);
    if (index >= 0) this.queue.splice(index, 1);
    clearTimeout(waiter.timer);
    if (waiter.onAbort) waiter.signal?.removeEventListener("abort", waiter.onAbort);
  }

  private createRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const waiter = this.queue.shift();
      if (!waiter) return;
      clearTimeout(waiter.timer);
      if (waiter.onAbort) waiter.signal?.removeEventListener("abort", waiter.onAbort);
      this.active += 1;
      waiter.resolve(this.createRelease());
    };
  }
}

const sharedBulkheads = new Map<string, ProviderBulkhead>();

export function getSharedProviderBulkhead(config: ProviderBulkheadConfig) {
  const key = `${config.maxConcurrent}:${config.maxQueued}:${config.queueTimeoutMs}`;
  const existing = sharedBulkheads.get(key);
  if (existing) return existing;
  const created = new ProviderBulkhead(config);
  sharedBulkheads.set(key, created);
  return created;
}
