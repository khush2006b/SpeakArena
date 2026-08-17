/**
 * @group business-logic
 * @coverage >95%
 *
 * Unit tests for the withRetry() utility and error normalisation logic
 * in src/services/api/interceptors.ts.
 *
 * The Axios interceptors themselves are tested via MSW in integration tests.
 * Here we focus on the pure withRetry() function.
 */

import { withRetry, setAccessToken, getAccessToken } from "@/services/api/interceptors";
import type { APIError } from "@/types";

// ---------------------------------------------------------------------------
// Token management functions
// ---------------------------------------------------------------------------

describe("setAccessToken() / getAccessToken()", () => {
  afterEach(() => {
    // Reset module state between tests
    setAccessToken(null);
  });

  it("returns null before any token is set", () => {
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves the access token", () => {
    setAccessToken("my-test-token");
    expect(getAccessToken()).toBe("my-test-token");
  });

  it("overwrites the previous token", () => {
    setAccessToken("token-one");
    setAccessToken("token-two");
    expect(getAccessToken()).toBe("token-two");
  });

  it("clears the token when set to null", () => {
    setAccessToken("some-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// withRetry()
// ---------------------------------------------------------------------------

describe("withRetry()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves immediately on first success", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on a retryable 502 error and succeeds on second attempt", async () => {
    const retryableError: APIError = { status: 502, code: "BAD_GATEWAY", message: "err" };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce("success-after-retry");

    const promise = withRetry(fn, 3);
    // Fast-forward through the exponential backoff delay (1000ms * 2^0 = 1000ms)
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success-after-retry");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on a non-retryable 404 error (no retries)", async () => {
    const notFoundError: APIError = { status: 404, code: "NOT_FOUND", message: "err" };
    const fn = jest.fn().mockRejectedValue(notFoundError);

    await expect(withRetry(fn)).rejects.toMatchObject({ status: 404 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a non-retryable 401 error", async () => {
    const authError: APIError = { status: 401, code: "UNAUTHORIZED", message: "err" };
    const fn = jest.fn().mockRejectedValue(authError);

    await expect(withRetry(fn)).rejects.toMatchObject({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max retries are exhausted", async () => {
    const retryableError: APIError = { status: 503, code: "SERVICE_UNAVAILABLE", message: "err" };
    const fn = jest.fn().mockRejectedValue(retryableError);

    const promise = withRetry(fn, 3);
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ status: 503 });
    // Called 4 times: initial + 3 retries
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("uses exponential backoff — delay doubles each attempt", async () => {
    const retryableError: APIError = { status: 502, code: "ERROR", message: "err" };
    const fn = jest.fn().mockRejectedValue(retryableError);

    jest.spyOn(global, "setTimeout");
    const promise = withRetry(fn, 2);
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toBeDefined();

    const calls = (setTimeout as jest.Mock).mock.calls;
    // 1st retry delay: 1000ms, 2nd retry delay: 2000ms
    expect(calls[0][1]).toBe(1000);
    expect(calls[1][1]).toBe(2000);
  });

  it("caps the retry delay at 8000ms", async () => {
    const retryableError: APIError = { status: 503, code: "ERROR", message: "err" };
    const fn = jest.fn().mockRejectedValue(retryableError);

    jest.spyOn(global, "setTimeout");
    const promise = withRetry(fn, 10); // many retries
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toBeDefined();

    const calls = (setTimeout as jest.Mock).mock.calls;
    // All delays should be <= 8000ms
    calls.forEach(([, delay]) => {
      expect(delay).toBeLessThanOrEqual(8000);
    });
  });
});
