import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  offersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    submit: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}));

import { offersApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import { OFFERS } from "@/test/fixtures";
import OffersPage, { offerBody, validateOffer } from "./OffersPage";

const render = () =>
  renderWith(<OffersPage />, { session: makeSession(), path: "/offers" });
const card = (id) => screen.getByTestId(`offer-${id}`);

beforeEach(() => offersApi.list.mockResolvedValue(OFFERS));
afterEach(() => vi.clearAllMocks());

describe("Offers", () => {
  it("each offer with its status chip and the actions its status allows", async () => {
    render();
    await screen.findByTestId("offer-o1");
    const expectations = {
      o1: ["Live", ["Edit", "Pause"]],
      o2: ["Draft", ["Edit", "Submit for review"]],
      o3: ["Changes needed", ["Edit", "Submit for review"]],
      o4: ["Paused", ["Edit", "Resume"]],
      o5: ["In review", ["Edit"]],
    };
    for (const [id, [chip, actions]] of Object.entries(expectations)) {
      expect(within(card(id)).getByText(chip)).toBeTruthy();
      expect(
        within(card(id))
          .getAllByRole("button")
          .map((b) => b.textContent.trim()),
      ).toEqual(actions);
    }
    expect(
      within(card("o3")).getByText("Yulo's note: Offers must be honest"),
    ).toBeTruthy();
    expect(within(card("o1")).getByText(/Valid 30 days/)).toBeTruthy();
  });

  it("new offer: validated (title 3+, days 1–365), then saved as a draft at the top", async () => {
    offersApi.create.mockResolvedValue({
      ...OFFERS[1],
      _id: "o9",
      title: "Free head massage",
      status: "draft",
    });
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "New offer" }));
    await user.type(screen.getByLabelText("Title"), "ab");
    await user.type(screen.getByLabelText("Valid for (days, optional)"), "400");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByText("Give the offer a short title")).toBeTruthy();
    expect(screen.getByText("Whole days from 1 to 365")).toBeTruthy();
    expect(offersApi.create).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "  Free head massage ");
    await user.clear(screen.getByLabelText("Valid for (days, optional)"));
    await user.type(
      screen.getByLabelText("Terms (optional)"),
      "With any haircut",
    );
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(offersApi.create).toHaveBeenCalledWith({
      title: "Free head massage",
      terms: "With any haircut",
      validityDays: null,
    });
    expect(await screen.findByTestId("offer-o9")).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("editing a live offer warns it goes back to review, then saves", async () => {
    offersApi.update.mockResolvedValue({
      ...OFFERS[0],
      title: "25% off any haircut",
      status: "pending_review",
    });
    const user = userEvent.setup();
    render();
    await user.click(
      within(await screen.findByTestId("offer-o1")).getByRole("button", {
        name: "Edit",
      }),
    );
    expect(screen.getByRole("note").textContent).toContain(
      "back to Yulo for review",
    );
    expect(screen.getByLabelText("Title").value).toBe("20% off any haircut");
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "25% off any haircut");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(offersApi.update).toHaveBeenCalledWith("o1", {
      title: "25% off any haircut",
      terms: "Weekdays only",
      validityDays: 30,
    });
    expect(
      within(await screen.findByTestId("offer-o1")).getByText("In review"),
    ).toBeTruthy();
  });

  it("editing a draft shows no review warning", async () => {
    const user = userEvent.setup();
    render();
    await user.click(
      within(await screen.findByTestId("offer-o2")).getByRole("button", {
        name: "Edit",
      }),
    );
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("submit, pause and resume call the API and update the chip", async () => {
    offersApi.submit.mockResolvedValue({
      ...OFFERS[1],
      status: "pending_review",
    });
    offersApi.pause.mockResolvedValue({ ...OFFERS[0], status: "paused" });
    offersApi.resume.mockResolvedValue({ ...OFFERS[3], status: "approved" });
    const user = userEvent.setup();
    render();
    await user.click(
      within(await screen.findByTestId("offer-o2")).getByRole("button", {
        name: "Submit for review",
      }),
    );
    expect(offersApi.submit).toHaveBeenCalledWith("o2");
    expect(await within(card("o2")).findByText("In review")).toBeTruthy();
    await user.click(within(card("o1")).getByRole("button", { name: "Pause" }));
    expect(await within(card("o1")).findByText("Paused")).toBeTruthy();
    await user.click(
      within(card("o4")).getByRole("button", { name: "Resume" }),
    );
    expect(await within(card("o4")).findByText("Live")).toBeTruthy();
  });

  it("a refused action shows the server's reason on that offer", async () => {
    offersApi.pause.mockRejectedValue(
      apiError(409, "INVALID_STATE", "A pending review offer cannot be paused"),
    );
    const user = userEvent.setup();
    render();
    await user.click(
      within(await screen.findByTestId("offer-o1")).getByRole("button", {
        name: "Pause",
      }),
    );
    expect(
      (await within(card("o1")).findByRole("alert")).textContent,
    ).toContain("cannot be paused");
  });

  it("empty and error states", async () => {
    offersApi.list
      .mockRejectedValueOnce(apiError(503, "X"))
      .mockResolvedValue([]);
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No offers yet/)).toBeTruthy();
  });

  it("validateOffer / offerBody", () => {
    expect(
      validateOffer({
        title: "x".repeat(121),
        terms: "y".repeat(2001),
        validityDays: "1.5",
      }),
    ).toEqual({
      title: "At most 120 characters",
      terms: "At most 2,000 characters",
      validityDays: "Whole days from 1 to 365",
    });
    expect(
      offerBody({ title: " A b c ", terms: " t ", validityDays: "45" }),
    ).toEqual({ title: "A b c", terms: "t", validityDays: 45 });
  });
});
