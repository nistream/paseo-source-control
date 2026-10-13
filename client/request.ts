let sequence = 0;

/** Owns one request lifetime; obsolete results never reach the caller's UI. */
export class RequestLifetime {
  readonly key = `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${++sequence}`;
  private active = true;
  private pending = true;
  constructor(private readonly cancel: (key: string) => Promise<unknown>) {}
  async run<T>(work: (key: string) => Promise<T>, success: (value: T) => void, failure: (error: Error) => void): Promise<void> {
    try {
      const value = await work(this.key);
      if (this.active) success(value);
    } catch (error) {
      if (this.active) failure(error instanceof Error ? error : new Error(String(error)));
    } finally { this.pending = false; }
  }
  dispose(): void {
    this.active = false;
    if (this.pending) void this.cancel(this.key).catch(() => {});
  }
}
