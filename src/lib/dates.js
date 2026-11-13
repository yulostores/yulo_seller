// Dates as the forms use them: <input type="date"> values ("YYYY-MM-DD") ↔ ISO strings.

/** "2026-03-05T00:00:00.000Z" (or a Date) → "2026-03-05" for a date input; "" for nothing. */
export const toDateInput = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/** Whole years between a "YYYY-MM-DD" birth date and `today`, or null. */
export function ageOn(ymd, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd ?? "")) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d)
  )
    age -= 1;
  return age;
}

/** True when a "YYYY-MM-DD" date is after today. */
export const isFuture = (ymd, today = new Date()) => {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return ymd > t;
};

/** "12 Nov 2026" in India. */
export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

/** A date-of-birth problem for a person who must be at least `minAge`, or "". */
export function dobError(ymd, minAge, who = "Must") {
  if (!ymd) return "Enter the date of birth";
  if (isFuture(ymd)) return "Date of birth cannot be in the future";
  const age = ageOn(ymd);
  if (age === null) return "Enter a valid date";
  if (age < minAge) return `${who} be at least ${minAge}`;
  if (age > 110) return "Check the date of birth";
  return "";
}
