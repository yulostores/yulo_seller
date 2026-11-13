import { describe, expect, it } from "vitest";
import { planHeading } from "./plans";

const basic = { plan: { key: "basic", name: "Basic" }, status: "active" };

describe("planHeading", () => {
  it("one plan, several plans (oldest first), none active, nothing", () => {
    expect(planHeading([{ key: "basic", name: "Basic" }], basic)).toBe(
      "Basic plan",
    );
    expect(
      planHeading(
        [
          { key: "basic", name: "Basic" },
          { key: "plus", name: "Plus" },
        ],
        basic,
      ),
    ).toBe("Basic + Plus plans");
    expect(planHeading([], { ...basic, status: "exhausted" })).toBe(
      "Basic plan",
    );
    expect(planHeading(undefined, null)).toBe("Plan");
  });
});
