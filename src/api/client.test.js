import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import client, {
  getAccessToken,
  normalise,
  onSessionEnded,
  refreshClient,
  refreshSession,
  setAccessToken,
} from "./client";

// A stand-in transport: each test scripts what the server answers per URL.
const reply = (config, status, body) => {
  if (status >= 400) {
    const err = new Error(`Request failed with status code ${status}`);
    err.config = config;
    err.response = { status, data: body, config, headers: {} };
    err.isAxiosError = true;
    return Promise.reject(err);
  }
  return Promise.resolve({
    status,
    data: body,
    config,
    headers: {},
    statusText: "OK",
  });
};

let apiCalls;
let refreshCalls;
let apiHandler;
let refreshHandler;

beforeEach(() => {
  apiCalls = [];
  refreshCalls = 0;
  setAccessToken(null);
  client.defaults.adapter = (config) => {
    apiCalls.push({
      url: config.url,
      auth: config.headers.Authorization ?? null,
    });
    return apiHandler(config);
  };
  refreshClient.defaults.adapter = (config) => {
    refreshCalls += 1;
    return refreshHandler(config);
  };
});
afterEach(() => {
  setAccessToken(null);
});

const expired = (config) =>
  reply(config, 401, {
    status: "error",
    code: "TOKEN_EXPIRED",
    message: "Token expired",
  });
const freshToken = (config) =>
  reply(config, 200, {
    status: "success",
    data: { accessToken: "fresh-token" },
  });

describe("API client — refresh on 401", () => {
  it("sends the access token on every request", async () => {
    setAccessToken("token-1");
    apiHandler = (config) => reply(config, 200, { data: { ok: true } });
    await client.get("/seller/dashboard");
    expect(apiCalls[0].auth).toBe("Bearer token-1");
  });

  it("an expired token: refreshes once, replays the request with the new token", async () => {
    setAccessToken("stale-token");
    apiHandler = (config) =>
      config.headers.Authorization === "Bearer fresh-token"
        ? reply(config, 200, { data: { ok: true } })
        : expired(config);
    refreshHandler = freshToken;
    const res = await client.get("/seller/dashboard");
    expect(res.data.data.ok).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(apiCalls.map((c) => c.auth)).toEqual([
      "Bearer stale-token",
      "Bearer fresh-token",
    ]);
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("no token at all after a reload (401 UNAUTHORIZED): the same recovery", async () => {
    apiHandler = (config) =>
      config.headers.Authorization
        ? reply(config, 200, { data: {} })
        : reply(config, 401, {
            code: "UNAUTHORIZED",
            message: "No token provided",
          });
    refreshHandler = freshToken;
    await client.get("/seller/plans");
    expect(apiCalls.map((c) => c.auth)).toEqual([null, "Bearer fresh-token"]);
  });

  it("five requests failing at once share ONE refresh", async () => {
    setAccessToken("stale-token");
    apiHandler = (config) =>
      config.headers.Authorization === "Bearer fresh-token"
        ? reply(config, 200, { data: {} })
        : expired(config);
    let release;
    refreshHandler = (config) =>
      new Promise((resolve) => (release = () => resolve(freshToken(config))));
    const all = Promise.all(
      Array.from({ length: 5 }, (_, i) => client.get(`/seller/x${i}`)),
    );
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    release();
    await all;
    expect(refreshCalls).toBe(1);
    expect(
      apiCalls.filter((c) => c.auth === "Bearer fresh-token"),
    ).toHaveLength(5);
  });

  it("the refresh itself answers 401: the session ends (listeners told, token cleared), the call fails", async () => {
    setAccessToken("stale-token");
    apiHandler = expired;
    refreshHandler = (config) =>
      reply(config, 401, {
        code: "INVALID_TOKEN",
        message: "No refresh token",
      });
    const ended = vi.fn();
    const unsubscribe = onSessionEnded(ended);
    await expect(client.get("/seller/dashboard")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_TOKEN",
    });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(apiCalls).toHaveLength(1, "not replayed");
    unsubscribe();
  });

  it("a rate-limited (429) refresh does not end the session", async () => {
    setAccessToken("stale-token");
    apiHandler = expired;
    refreshHandler = (config) =>
      reply(config, 429, { code: "RATE_LIMITED", message: "Too many" });
    const ended = vi.fn();
    const unsubscribe = onSessionEnded(ended);
    await expect(client.get("/seller/dashboard")).rejects.toMatchObject({
      status: 429,
    });
    expect(ended).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("a server error on refresh is retried before giving up", async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      refreshHandler = (config) =>
        ++n < 3 ? reply(config, 503, { code: "X" }) : freshToken(config);
      const p = refreshSession();
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBe("fresh-token");
      expect(refreshCalls).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sign-in endpoints never trigger a refresh: a wrong code is the user's input, not an expired session", async () => {
    apiHandler = (config) =>
      reply(config, 401, {
        code: "INVALID_TOKEN",
        message: "Invalid signup proof",
      });
    refreshHandler = freshToken;
    for (const url of [
      "/seller/auth/otp/verify",
      "/seller/auth/signup",
      "/seller/auth/select-account",
      "/seller/auth/login",
    ]) {
      await expect(client.post(url, {})).rejects.toMatchObject({ status: 401 });
    }
    expect(refreshCalls).toBe(0);
  });

  it("a request already replayed once is not refreshed again (no loops)", async () => {
    setAccessToken("stale-token");
    apiHandler = expired; // even the fresh token is refused
    refreshHandler = freshToken;
    await expect(client.get("/seller/dashboard")).rejects.toMatchObject({
      status: 401,
      code: "TOKEN_EXPIRED",
    });
    expect(refreshCalls).toBe(1);
    expect(apiCalls).toHaveLength(2);
  });

  it("errors reach screens as plain Errors with the server's code, status and details", async () => {
    apiHandler = (config) =>
      reply(config, 400, {
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Enter a valid phone",
        details: { fieldErrors: { phone: ["Bad"] } },
      });
    const err = await client.post("/seller/auth/otp/send", {}).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect([err.message, err.code, err.status]).toEqual([
      "Enter a valid phone",
      "VALIDATION_ERROR",
      400,
    ]);
    expect(err.details.fieldErrors.phone).toEqual(["Bad"]);
    const offline = normalise(new Error("Network Error"));
    expect([offline.code, offline.status]).toEqual([undefined, undefined]);
  });
});
