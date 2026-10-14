import { expect, it } from "vitest";
import { RequestLifetime } from "../client/request.js";

it("cancels obsolete selections and discards their late successes and errors", async () => {
  const cancelled: string[] = [];
  const values: string[] = [];
  const errors: string[] = [];
  let finish!: (value: string) => void;
  const old = new RequestLifetime(async (key) => { cancelled.push(key); });
  const pending = old.run(() => new Promise<string>((resolve) => { finish = resolve; }), (value) => values.push(value), (error) => errors.push(error.message));
  old.dispose();
  const current = new RequestLifetime(async (key) => { cancelled.push(key); });
  await current.run(async () => "new selection", (value) => values.push(value), (error) => errors.push(error.message));
  finish("old selection");
  await pending;
  expect(values).toEqual(["new selection"]);
  expect(cancelled).toEqual([old.key]);
  expect(old.key).not.toBe(current.key);
  let reject!: (error: Error) => void;
  const staleError = new RequestLifetime(async () => {});
  const failed = staleError.run(() => new Promise<string>((_, fail) => { reject = fail; }), (value) => values.push(value), (error) => errors.push(error.message));
  staleError.dispose();
  reject(new Error("stale network failure"));
  await failed;
  expect(errors).toEqual([]);
  current.dispose();
  expect(cancelled).toEqual([old.key]);
});
