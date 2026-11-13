// Session fixtures: every role × seller status the guard has to handle.
export const ROLES = ["owner", "manager", "employee"];
export const STATUSES = ["pending", "rejected", "active", "suspended"];

export function makeSession({
  role = "owner",
  status = "active",
  name = "Asha Rao",
  business = "Glow Salon",
} = {}) {
  return {
    user: { _id: `u-${role}`, name, phone: "9822222221", role, sellerId: "s1" },
    seller: {
      _id: "s1",
      businessName: business,
      status,
      rejectionReason: status === "rejected" ? "PAN photo is blurred" : null,
    },
    permissions: [],
    hasPassword: false,
  };
}

/** A context value for SellerAuthContext.Provider (no provider effects). */
export function authValue(session, overrides = {}) {
  return {
    session,
    state: "ready",
    isSignedIn: Boolean(session),
    sendOtp: async () => ({}),
    verifyOtp: async () => ({ kind: "session" }),
    signup: async () => ({}),
    selectAccount: async () => ({}),
    passwordLogin: async () => ({}),
    logout: async () => {},
    reload: async () => {},
    retryRestore: async () => {},
    ...overrides,
  };
}

/** React Router v7 behaviour, as in main.jsx (and no future-flag warnings in test output). */
export const ROUTER_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};
