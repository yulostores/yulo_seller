// Money in the portal: the API sends integer paise (…Paise) and rupees for display; formatted the
// Indian way (₹1,77,000).
const whole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
// With paise, always two decimals: ₹931.50, never ₹931.5.
const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inr = (rupees) =>
  (Number.isInteger(Math.round(rupees * 100) / 100) ? whole : withPaise).format(
    rupees,
  );

/** 590000 → "₹5,900" ; 35400 → "₹354" ; 354 → "₹3.54" ; 93150 → "₹931.50" */
export const formatPaise = (paise) =>
  Number.isFinite(paise) ? inr(paise / 100) : "—";
/** 5900 → "₹5,900" ; 931.5 → "₹931.50" */
export const formatRupees = (rupees) =>
  Number.isFinite(rupees) ? inr(rupees) : "—";
