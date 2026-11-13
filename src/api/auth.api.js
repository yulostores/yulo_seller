import client from "./client";

// Seller sign-in and session — /api/seller/auth (API.md § Seller — Sign-in and session).
// Every function resolves to the response's `data` (the envelope is unwrapped here).
const data = (promise) => promise.then((res) => res.data.data);

export const authApi = {
  /** Every category, for the signup form: [{ _id, key, name, icon }]. Public. */
  categories: () =>
    data(client.get("/seller/auth/categories")).then((d) => d.categories),
  /** { phone, devOtp? } — devOtp only outside production with the mock SMS provider. */
  sendOtp: (phone) => data(client.post("/seller/auth/otp/send", { phone })),
  /**
   * One of: a session { accessToken, user, seller, permissions };
   * { needsSignup, phone, signupToken }; { needsAccountChoice, selectToken, accounts }.
   */
  verifyOtp: (phone, code) =>
    data(client.post("/seller/auth/otp/verify", { phone, code })),
  /** A session; the seller starts `pending`. */
  signup: ({ signupToken, businessName, categoryId, ownerName }) =>
    data(
      client.post("/seller/auth/signup", {
        signupToken,
        businessName,
        categoryId,
        ownerName,
      }),
    ),
  /** A session for the chosen login. */
  selectAccount: (selectToken, sellerUserId) =>
    data(
      client.post("/seller/auth/select-account", { selectToken, sellerUserId }),
    ),
  /** Owners who set a password. A session. */
  passwordLogin: (phone, password) =>
    data(client.post("/seller/auth/login", { phone, password })),
  /** Owners only: set a sign-in password, or change it (then `currentPassword` is required). */
  setPassword: (newPassword, currentPassword) =>
    data(
      client.post("/seller/auth/password", {
        newPassword,
        ...(currentPassword ? { currentPassword } : {}),
      }),
    ),
  /** { user, seller, permissions, hasPassword, expiresAt } */
  me: () => data(client.get("/seller/auth/me")),
  logout: () => data(client.post("/seller/auth/logout")),
};
