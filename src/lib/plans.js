/**
 * The heading for a seller's plans: "Basic plan", or "Basic + Plus plans" once they have bought
 * more than one (stock is drawn from the oldest first, so `currentPlan` alone named only Basic).
 * `activePlans` = [{ key, name }] from the API, oldest first; falls back to `currentPlan` when the
 * plans are all used up (none active).
 */
export function planHeading(activePlans, currentPlan) {
  const names = (activePlans ?? []).map((p) => p.name).filter(Boolean);
  if (names.length > 1) return `${names.join(" + ")} plans`;
  if (names.length === 1) return `${names[0]} plan`;
  return currentPlan?.plan?.name ? `${currentPlan.plan.name} plan` : "Plan";
}
