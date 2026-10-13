import { spawn } from "node:child_process";

export class CommandError extends Error {
  constructor(message: string, public readonly reason: "failed" | "timeout" | "cancelled" | "large" | "missing") {
    super(message);
  }
}

export interface CommandOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  allowedExitCodes?: number[];
}

/** No shell, no interactive input, and one combined stdout/stderr byte budget. */
export function run(executable: string, args: string[], options: CommandOptions): Promise<string> {
  if (options.signal?.aborted) return Promise.reject(new CommandError("Request cancelled", "cancelled"));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let bytes = 0;
    let failure: CommandError | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = (reason: CommandError) => {
      if (failure) return;
      failure = reason;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 200);
    };
    const abort = () => stop(new CommandError("Request cancelled", "cancelled"));
    options.signal?.addEventListener("abort", abort, { once: true });
    // Cover an abort between the initial check and listener registration.
    if (options.signal?.aborted) abort();
    const timer = setTimeout(() => stop(new CommandError(`${executable} timed out; refresh or check network/authentication`, "timeout")), options.timeoutMs ?? 15000);
    const collect = (chunks: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) {
        stop(new CommandError(`${executable} output exceeds the limit; inspect a narrower scope`, "large"));
      } else if (!failure) chunks.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(out, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(err, chunk));
    const cleanup = () => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", abort);
    };
    child.on("error", (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(new CommandError(error.code === "ENOENT" ? `${executable} is not installed on this daemon's PATH` : `${executable}: ${error.message}`, error.code === "ENOENT" ? "missing" : "failed"));
    });
    child.on("close", (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (!(options.allowedExitCodes ?? [0]).includes(code ?? -1)) {
        reject(new CommandError(`${executable} ${args[0] ?? ""} failed (${code}): ${Buffer.concat(err).toString("utf8").slice(0, 2000)}`, "failed"));
      } else resolve(Buffer.concat(out).toString("utf8"));
    });
  });
}

/** Request keys are random per panel; cancellation never relies on SDK AbortSignal. */
export class Requests {
  private readonly active = new Map<string, AbortController>();
  private readonly operations = new Set<AbortController>();
  private readonly cancelled = new Map<string, number>();
  private disposed = false;
  async execute<T>(key: string | undefined, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.disposed) throw new CommandError("Plugin stopped", "cancelled");
    for (const [id, time] of this.cancelled) if (time < Date.now() - 60000) this.cancelled.delete(id);
    const controller = new AbortController();
    if (key) {
      if (this.active.has(key)) throw new Error("Request key already active");
      if (this.cancelled.has(key)) throw new CommandError("Request cancelled", "cancelled");
      this.active.set(key, controller);
    }
    this.operations.add(controller);
    try { return await work(controller.signal); }
    finally {
      this.operations.delete(controller);
      if (key) this.active.delete(key);
    }
  }
  cancel(key: string): boolean {
    const controller = this.active.get(key);
    controller?.abort();
    // Remember cancellation that arrives before its work RPC.
    if (this.cancelled.size >= 1000) this.cancelled.delete(this.cancelled.keys().next().value!);
    this.cancelled.set(key, Date.now());
    return !!controller;
  }
  dispose(): void {
    this.disposed = true;
    for (const controller of this.operations) controller.abort();
    this.operations.clear();
    this.active.clear();
    this.cancelled.clear();
  }
}
