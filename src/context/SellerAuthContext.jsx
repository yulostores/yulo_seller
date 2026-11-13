import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/api/auth.api";
import {
  getAccessToken,
  onSessionEnded,
  refreshSession,
  setAccessToken,
} from "@/api/client";

// The signed-in seller login, from GET /api/seller/auth/me (or a sign-in response).
//
//   session = { user: { _id, name, phone, role, sellerId }, seller: { _id, businessName, status,
//               rejectionReason }, permissions: [...], hasPassword }
//
// The access token is in memory only. After a reload the refresh cookie mints a new one — but
// only when this browser has signed in before (a non-sensitive flag in localStorage), so a
// first visit doesn't fire a refresh that can only fail.
//
// While the business isn't approved yet the session is re-read every minute and whenever the tab
// regains focus, so the portal unlocks on its own the moment Yulo approves it.

const SIGNED_IN_FLAG = "yulo_seller_signed_in";
const POLL_MS = 60_000;

const SellerAuthContext = createContext(null);

const readFlag = () => {
  try {
    return localStorage.getItem(SIGNED_IN_FLAG) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (on) => {
  try {
    if (on) localStorage.setItem(SIGNED_IN_FLAG, "1");
    else localStorage.removeItem(SIGNED_IN_FLAG);
  } catch {
    /* storage unavailable (private mode) — the session simply won't survive a reload */
  }
};

export function SellerAuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  // 'loading' while a stored session is being restored, 'ready' once we know, 'error' when the
  // restore failed for a reason that isn't "signed out" (offline, server down).
  const [state, setState] = useState(() => (readFlag() ? "loading" : "ready"));
  const mounted = useRef(true);
  // Set on every mount, not only the first: StrictMode mounts, unmounts and remounts, and a
  // guard left false would drop the restored session after a reload.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const clearLocal = useCallback(() => {
    setAccessToken(null);
    writeFlag(false);
    setSession(null);
    queryClient.clear();
    setState("ready");
  }, [queryClient]);

  // The server ended the session (refresh answered 401): back to the login screen.
  useEffect(() => onSessionEnded(clearLocal), [clearLocal]);

  const loadMe = useCallback(async () => {
    const me = await authApi.me();
    if (!mounted.current) return null;
    setSession({
      user: me.user,
      seller: me.seller,
      permissions: me.permissions ?? [],
      hasPassword: Boolean(me.hasPassword),
    });
    return me;
  }, []);

  const restore = useCallback(async () => {
    setState("loading");
    try {
      if (!getAccessToken()) await refreshSession();
      await loadMe();
      setState("ready");
    } catch (err) {
      if (err?.status === 401) clearLocal();
      else if (mounted.current) setState("error");
    }
  }, [loadMe, clearLocal]);

  // On load: restore a session this browser had.
  useEffect(() => {
    if (readFlag()) restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Waiting for approval: re-check every minute and on focus.
  const waiting = session && session.seller.status !== "active";
  useEffect(() => {
    if (!waiting) return undefined;
    const check = () => loadMe().catch(() => {});
    const id = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [waiting, loadMe]);

  /** Starts a session from a sign-in response ({ accessToken, user, seller, permissions }). */
  const startSession = useCallback(
    (data) => {
      queryClient.clear(); // nothing from a previous login may leak into this one
      setAccessToken(data.accessToken);
      writeFlag(true);
      setSession({
        user: data.user,
        seller: data.seller,
        permissions: data.permissions ?? [],
        hasPassword: false,
      });
      setState("ready");
      loadMe().catch(() => {}); // fills hasPassword
      return data;
    },
    [loadMe, queryClient],
  );

  /**
   * Checks an OTP. Resolves to one of:
   *   { kind: 'session' }                                — signed in
   *   { kind: 'signup', signupToken, phone }             — no business on this number yet
   *   { kind: 'choose', selectToken, accounts }          — logins at several businesses
   */
  const verifyOtp = useCallback(
    async (phone, code) => {
      const data = await authApi.verifyOtp(phone, code);
      if (data.accessToken) {
        startSession(data);
        return { kind: "session" };
      }
      if (data.needsSignup)
        return {
          kind: "signup",
          signupToken: data.signupToken,
          phone: data.phone,
        };
      if (data.needsAccountChoice)
        return {
          kind: "choose",
          selectToken: data.selectToken,
          accounts: data.accounts,
        };
      throw new Error("Unexpected sign-in response");
    },
    [startSession],
  );

  const signup = useCallback(
    async (input) => startSession(await authApi.signup(input)),
    [startSession],
  );
  const selectAccount = useCallback(
    async (selectToken, sellerUserId) =>
      startSession(await authApi.selectAccount(selectToken, sellerUserId)),
    [startSession],
  );
  const passwordLogin = useCallback(
    async (phone, password) =>
      startSession(await authApi.passwordLogin(phone, password)),
    [startSession],
  );

  /** Signs out here and on the server. Local state is cleared even if the server can't be reached. */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the refresh cookie expires on its own; nothing more we can do offline */
    } finally {
      clearLocal();
    }
  }, [clearLocal]);

  const value = useMemo(
    () => ({
      session,
      state,
      isSignedIn: Boolean(session),
      sendOtp: authApi.sendOtp,
      verifyOtp,
      signup,
      selectAccount,
      passwordLogin,
      logout,
      reload: loadMe,
      retryRestore: restore,
    }),
    [
      session,
      state,
      verifyOtp,
      signup,
      selectAccount,
      passwordLogin,
      logout,
      loadMe,
      restore,
    ],
  );

  return (
    <SellerAuthContext.Provider value={value}>
      {children}
    </SellerAuthContext.Provider>
  );
}

export function useSellerAuth() {
  const ctx = useContext(SellerAuthContext);
  if (!ctx)
    throw new Error("useSellerAuth must be used inside <SellerAuthProvider>");
  return ctx;
}

// For tests and stories: provide a fixed value without the provider's effects.
export { SellerAuthContext };
