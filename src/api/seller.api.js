import client from "./client";

// Seller portal business APIs (yulo_backend/API.md § Coupons). Each resolves to the response's
// `data`; failures reject with the client's normalised Error (code / status / details).
const data = (promise) => promise.then((res) => res.data.data);

export const onboardingApi = {
  get: () => data(client.get("/seller/onboarding")),
  saveBusiness: (body) => data(client.put("/seller/onboarding/business", body)),
  saveOwner: (body) => data(client.put("/seller/onboarding/owner", body)),
  saveEmployees: (employees) =>
    data(client.put("/seller/onboarding/employees", { employees })),
  /** multipart: the file and its type. Resolves to { documents }. */
  uploadDocument: (type, file) => {
    const form = new FormData();
    form.append("type", type);
    form.append("document", file);
    return data(client.post("/seller/onboarding/documents", form));
  },
  deleteDocument: (docId) =>
    data(client.delete(`/seller/onboarding/documents/${docId}`)),
  /** The file as a Blob (streamed through the API; storage URLs are never exposed). */
  documentFile: (docId) =>
    client
      .get(`/seller/onboarding/documents/${docId}/file`, {
        responseType: "blob",
      })
      .then((res) => res.data),
  submit: () => data(client.post("/seller/onboarding/submit")),
  status: () => data(client.get("/seller/status")),
};

export const accountApi = {
  profile: () => data(client.get("/seller/profile")).then((d) => d.profile),
  updateProfile: (body) =>
    data(client.patch("/seller/profile", body)).then((d) => d.profile),
  agreement: () =>
    data(client.get("/seller/agreement")).then((d) => d.agreement),
  acceptAgreement: (version) =>
    data(client.post("/seller/agreement/accept", { version })).then(
      (d) => d.agreement,
    ),
};

export const teamApi = {
  list: () => data(client.get("/seller/users")),
  add: (body) => data(client.post("/seller/users", body)).then((d) => d.member),
  update: (id, body) =>
    data(client.patch(`/seller/users/${id}`, body)).then((d) => d.member),
  remove: (id) =>
    data(client.delete(`/seller/users/${id}`)).then((d) => d.member),
};

export const categoriesApi = {
  list: () =>
    data(client.get("/seller/auth/categories")).then((d) => d.categories),
};

export const plansApi = {
  /** Plans on sale: [{ key, name, couponAllocation, gstPercent, price: { base, gst, total }, …Paise }] */
  list: () => data(client.get("/seller/plans")).then((d) => d.plans),
  /** { subscriptions, stock: { allocated, issued, remaining }, currentPlan } */
  subscriptions: () => data(client.get("/seller/subscriptions")),
  /** { subscription, razorpayOrder, paymentSimulated } — owner only. */
  buy: (planKey) => data(client.post("/seller/subscriptions", { planKey })),
  verify: (subscriptionId, fields) =>
    data(
      client.post(`/seller/subscriptions/${subscriptionId}/verify`, fields),
    ).then((d) => d.subscription),
  /** Local development only (ALLOW_PAYMENT_SIMULATION). */
  simulate: (subscriptionId) =>
    data(
      client.post(`/seller/subscriptions/${subscriptionId}/simulate-payment`),
    ).then((d) => d.subscription),
};

export const redeemApi = {
  /** { coupon: { code, offerTitle, terms, category, customerFirstName, issuedAt, expiresAt, status, needsPhoneCheck, redeemedAt?, redeemedByName? } } */
  lookup: (code) =>
    data(client.post("/seller/redeem/lookup", { code })).then((d) => d.coupon),
  /** The redeemed coupon (+ redeemedAt, redeemedByName). */
  redeem: (code, phoneLast4) =>
    data(
      client.post("/seller/redeem", {
        code,
        ...(phoneLast4 ? { phoneLast4 } : {}),
      }),
    ).then((d) => d.coupon),
  /** { scope: 'mine'|'business', count, redemptions: [{ code, offerTitle, category, customerFirstName, redeemedAt, redeemedByName }] } */
  today: () => data(client.get("/seller/redeem/today")),
};

// Report filters → query params, leaving out what isn't set.
const reportParams = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );

export const reportsApi = {
  /** { plans, currentPlan, stock: { allocated, issued, pending }, coupons: { issued, active, redeemed, expired, void, redemptionRate }, recentCoupons } */
  dashboard: () => data(client.get("/seller/dashboard")),
  /** { total, counts, gender: { male, female, other, not_given }, ageBands: { … } } */
  demographics: (filters) =>
    data(
      client.get("/seller/reports/demographics", {
        params: reportParams(filters),
      }),
    ),
  /** { interval, from, to, series: [{ bucket, issued, redeemed }], totals } */
  trends: (filters) =>
    data(
      client.get("/seller/reports/trends", { params: reportParams(filters) }),
    ),
  /** { coupons: [row], total, page, limit } */
  coupons: (filters) =>
    data(
      client.get("/seller/reports/coupons", { params: reportParams(filters) }),
    ),
  /** The CSV as a Blob (needs the session token, so it's fetched, not linked). */
  couponsCsv: (filters) =>
    client
      .get("/seller/reports/coupons.csv", {
        params: reportParams(filters),
        responseType: "blob",
      })
      .then((res) => res.data),
};

export const offersApi = {
  list: () => data(client.get("/seller/offers")).then((d) => d.offers),
  create: (body) =>
    data(client.post("/seller/offers", body)).then((d) => d.offer),
  update: (id, body) =>
    data(client.patch(`/seller/offers/${id}`, body)).then((d) => d.offer),
  submit: (id) =>
    data(client.post(`/seller/offers/${id}/submit`)).then((d) => d.offer),
  pause: (id) =>
    data(client.post(`/seller/offers/${id}/pause`)).then((d) => d.offer),
  resume: (id) =>
    data(client.post(`/seller/offers/${id}/resume`)).then((d) => d.offer),
};

export const smsApi = {
  /** { balance, perSms, packs, available, purchases } */
  credits: () => data(client.get("/seller/sms-credits")),
  /** { purchase, razorpayOrder, paymentSimulated } */
  buy: (credits) =>
    data(client.post("/seller/sms-credits/purchase", { credits })),
  verify: (purchaseId, fields) =>
    data(
      client.post(`/seller/sms-credits/purchase/${purchaseId}/verify`, fields),
    ).then((d) => d.purchase),
  simulate: (purchaseId) =>
    data(
      client.post(
        `/seller/sms-credits/purchase/${purchaseId}/simulate-payment`,
      ),
    ).then((d) => d.purchase),
  /** { credits, reminderLeadDays, perSms, expiringSoon, sent } */
  reminders: () => data(client.get("/seller/reminders")),
};
