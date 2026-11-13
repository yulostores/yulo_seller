import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    categories: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signup: vi.fn(),
    selectAccount: vi.fn(),
    passwordLogin: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));
// The real client, except: refresh is scripted per test, and the "session ended" broadcast can be
// fired by the test exactly as client.js fires it when a refresh answers 401.
vi.mock("@/api/client", async (importOriginal) => {
  const real = await importOriginal();
  const handlers = new Set();
  return {
    ...real,
    refreshSession: vi.fn(),
    onSessionEnded: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    __endSession: () => handlers.forEach((handler) => handler()),
  };
});

import { authApi } from "@/api/auth.api";
import * as client from "@/api/client";
import { SellerAuthProvider, useSellerAuth } from "./SellerAuthContext";
import { sessionResponse } from "@/test/renderApp";

const FLAG = "yulo_seller_signed_in";
const apiError = (status, code) =>
  Object.assign(new Error(code), { status, code, isApiError: true });

let auth;
let queryClient;
function Probe() {
  auth = useSellerAuth();
  return (
    <p data-testid="probe">
      {auth.state}:{auth.session?.user?.role ?? "none"}
    </p>
  );
}
function renderProvider() {
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SellerAuthProvider>
        <Probe />
      </SellerAuthProvider>
    </QueryClientProvider>,
  );
}
const probe = () => screen.getByTestId("probe").textContent;

beforeEach(() => {
  localStorage.clear();
  client.setAccessToken(null);
  authApi.me.mockResolvedValue({
    ...sessionResponse({ role: "manager" }),
    hasPassword: true,
  });
});
afterEach(() => vi.clearAllMocks());

describe("SellerAuthContext", () => {
  it("first visit (never signed in here): no refresh attempt, signed out", () => {
    renderProvider();
    expect(probe()).toBe("ready:none");
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  it("after a reload: restores the session from the refresh cookie, then GET /me", async () => {
    localStorage.setItem(FLAG, "1");
    client.refreshSession.mockImplementation(async () => {
      client.setAccessToken("restored");
      return "restored";
    });
    renderProvider();
    expect(probe()).toBe("loading:none");
    await waitFor(() => expect(probe()).toBe("ready:manager"));
    expect(auth.session.hasPassword).toBe(true);
  });

  // CF10 browser run: under StrictMode (main.jsx) React mounts, unmounts and remounts the
  // provider; the "mounted" guard stayed false after the remount, so the restored /me answer was
  // dropped and every reload landed on the login screen.
  it("after a reload under StrictMode (as in main.jsx): the session is restored", async () => {
    localStorage.setItem(FLAG, "1");
    client.refreshSession.mockImplementation(async () => {
      client.setAccessToken("restored");
      return "restored";
    });
    queryClient = new QueryClient();
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <SellerAuthProvider>
            <Probe />
          </SellerAuthProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(probe()).toBe("ready:manager"));
  });

  it("after a reload with an expired cookie: signed out, the flag forgotten", async () => {
    localStorage.setItem(FLAG, "1");
    client.refreshSession.mockRejectedValue(apiError(401, "INVALID_TOKEN"));
    renderProvider();
    await waitFor(() => expect(probe()).toBe("ready:none"));
    expect(localStorage.getItem(FLAG)).toBeNull();
  });

  it("after a reload while offline: an error state that can be retried — still signed in", async () => {
    localStorage.setItem(FLAG, "1");
    client.refreshSession.mockRejectedValueOnce(
      Object.assign(new Error("Network Error"), { isApiError: true }),
    );
    renderProvider();
    await waitFor(() => expect(probe()).toBe("error:none"));
    expect(localStorage.getItem(FLAG)).toBe(
      "1",
      "the session isn't thrown away",
    );
    client.refreshSession.mockImplementation(async () => {
      client.setAccessToken("restored");
      return "restored";
    });
    await act(() => auth.retryRestore());
    expect(probe()).toBe("ready:manager");
  });

  it("logout clears everything: token, session, the stored flag, cached data — and tells the server", async () => {
    authApi.verifyOtp.mockResolvedValue(sessionResponse({ role: "owner" }));
    authApi.logout.mockResolvedValue(null);
    renderProvider();
    await act(() => auth.verifyOtp("9822222221", "123456"));
    await waitFor(() => expect(probe()).toBe("ready:manager")); // /me (mocked) answered
    queryClient.setQueryData(["dashboard"], { secret: true });
    expect(client.getAccessToken()).toBe("token-owner");
    expect(localStorage.getItem(FLAG)).toBe("1");

    await act(() => auth.logout());
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(probe()).toBe("ready:none");
    expect(client.getAccessToken()).toBeNull();
    expect(localStorage.getItem(FLAG)).toBeNull();
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined();
  });

  it("logout still clears local state when the server can't be reached", async () => {
    authApi.verifyOtp.mockResolvedValue(sessionResponse({ role: "owner" }));
    authApi.logout.mockRejectedValue(
      Object.assign(new Error("Network Error"), { isApiError: true }),
    );
    renderProvider();
    await act(() => auth.verifyOtp("9822222221", "123456"));
    await act(() => auth.logout());
    expect(probe()).toBe("ready:none");
    expect(client.getAccessToken()).toBeNull();
  });

  it("the server ending the session mid-visit (refresh 401 broadcast) signs the person out", async () => {
    authApi.verifyOtp.mockResolvedValue(sessionResponse({ role: "owner" }));
    authApi.me.mockResolvedValue({
      ...sessionResponse({ role: "owner" }),
      hasPassword: false,
    });
    renderProvider();
    await act(() => auth.verifyOtp("9822222221", "123456"));
    expect(probe()).toBe("ready:owner");
    act(() => client.__endSession()); // POST /seller/auth/refresh answered 401
    expect(probe()).toBe("ready:none");
  });

  it("signing in again clears the previous login's cached data", async () => {
    authApi.verifyOtp.mockResolvedValue(sessionResponse({ role: "owner" }));
    renderProvider();
    queryClient.setQueryData(["dashboard"], { from: "previous login" });
    await act(() => auth.verifyOtp("9822222221", "123456"));
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined();
  });

  it("verifyOtp: maps the server's three answers", async () => {
    renderProvider();
    authApi.verifyOtp.mockResolvedValueOnce({
      needsSignup: true,
      phone: "9822222221",
      signupToken: "p",
    });
    await expect(auth.verifyOtp("9822222221", "1")).resolves.toEqual({
      kind: "signup",
      signupToken: "p",
      phone: "9822222221",
    });
    authApi.verifyOtp.mockResolvedValueOnce({
      needsAccountChoice: true,
      selectToken: "s",
      accounts: [],
    });
    await expect(auth.verifyOtp("9822222221", "1")).resolves.toEqual({
      kind: "choose",
      selectToken: "s",
      accounts: [],
    });
    expect(probe()).toBe("ready:none", "neither signs anyone in");
  });

  it("a business waiting for approval is re-checked on focus and unlocks on its own", async () => {
    authApi.verifyOtp.mockResolvedValue(
      sessionResponse({ role: "owner", status: "pending" }),
    );
    authApi.me.mockResolvedValue({
      ...sessionResponse({ role: "owner", status: "pending" }),
      hasPassword: false,
    });
    renderProvider();
    await act(() => auth.verifyOtp("9822222221", "123456"));
    await waitFor(() => expect(auth.session.seller.status).toBe("pending"));
    authApi.me.mockResolvedValue({
      ...sessionResponse({ role: "owner", status: "active" }),
      hasPassword: false,
    });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(auth.session.seller.status).toBe("active"));
  });
});
