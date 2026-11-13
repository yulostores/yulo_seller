// Money in the portal: the API sends integer paise (…Paise) and rupees for display; formatted the
// Indian way (₹1,77,000).
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** 590000 → "₹5,900" ; 35400 → "₹354" ; 354 → "₹3.54" */
export const formatPaise = (paise) =>
  Number.isFinite(paise) ? inr.format(paise / 100) : "—";
/** 5900 → "₹5,900" */
export const formatRupees = (rupees) =>
  Number.isFinite(rupees) ? inr.format(rupees) : "—";
