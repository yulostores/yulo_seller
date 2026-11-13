import axios from "axios";
import { API_BASE } from "./config";

// The seller portal's one HTTP client.
//
// Session model (yulo_backend/API.md § Coupons — Seller authentication):
//   - a short-lived access token (15 min), kept in MEMORY only — never localStorage;
//   - a 7-day refresh token in the httpOnly cookie `yulo_rt_seller`, which this code never sees;
//     POST /api/seller/auth/refresh trades it for a new access token.
//
// Every request carries the access token. A 401 that a fresh token could fix (expired, revoked,
// or no token at all after a reload) triggers one refresh and one replay of the request. If the
// refresh itself answers 401, the session is over: listeners (SellerAuthContext) are told, the
// user lands on the login screen. Anything else (429, 5xx, offline) is NOT the end of the
// session — the cookie is still good and the next request will heal it.

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}
export function getAccessToken() {
  return accessToken;
}

// API calls. Exported so tests can swap the transport (client.defaults.adapter).
const client = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

// The refresh call goes through its own instance, so the response interceptor below can never
// recurse into itself.
export const refreshClient = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization)
    config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Session ended ─────────────────────────────────────────────────────────────
const sessionEndedHandlers = new Set();
/** Called when the server says the session is over (refresh answered 401). Returns an unsubscribe. */
export function onSessionEnded(handler) {
  sessionEndedHandlers.add(handler);
  return () => sessionEndedHandlers.delete(handler);
}

// ── Refresh (single-flight) ───────────────────────────────────────────────────
// A page load fires several queries that can all find the token missing at once; they share one
// refresh instead of stampeding the endpoint (its rate limit is per IP).
let refreshing = null;

export function refreshSession() {
  if (!refreshing) {
    refreshing = attemptRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function attemptRefresh(attempt = 0) {
  try {
    // No body on purpose: an `{}` payload would make this a preflighted CORS request.
    const { data } = await refreshClient.post("/seller/auth/refresh");
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch (raw) {
    const err = normalise(raw);
    const transient = err.status === undefined || err.status >= 500;
    if (transient && attempt < 2) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      return attemptRefresh(attempt + 1);
    }
    if (err.status === 401) {
      setAccessToken(null);
      for (const handler of sessionEndedHandlers) handler(err);
    }
    throw err;
  }
}

// ── 401 → refresh → replay ────────────────────────────────────────────────────
const RECOVERABLE_401 = new Set([
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "UNAUTHORIZED",
]);
// Sign-in endpoints answer 401 for a wrong code / password or a used proof — that is the user's
// input, not an expired session, so they are never refreshed and replayed.
const NO_REFRESH = /^\/seller\/auth\/(otp|signup|select-account|login|refresh)/;

client.interceptors.response.use(
  (res) => res,
  async (raw) => {
    const original = raw.config ?? {};
    const status = raw.response?.status;
    const code = raw.response?.data?.code;
    if (
      status === 401 &&
      RECOVERABLE_401.has(code) &&
      !original._retried &&
      !NO_REFRESH.test(original.url ?? "")
    ) {
      original._retried = true;
      const token = await refreshSession(); // rejects (normalised) when the session is over
      original.headers = {
        ...original.headers,
        Authorization: `Bearer ${token}`,
      };
      return client(original);
    }
    return Promise.reject(normalise(raw));
  },
);

/** A plain Error carrying the API's code / status / details — what every screen catches. */
export function normalise(raw) {
  if (raw?.isApiError) return raw;
  const body = raw?.response?.data;
  const err = new Error(body?.message ?? raw?.message ?? "Request failed");
  err.isApiError = true;
  err.code = body?.code;
  err.status = raw?.response?.status;
  err.details = body?.details;
  return err;
}

export default client;
