import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  redeemApi: { lookup: vi.fn(), redeem: vi.fn(), today: vi.fn() },
}));
// The camera is tested in QrScanner.test.jsx; here a stand-in "scans" whatever the test says.
vi.mock("@/components/QrScanner", () => ({
  QrScanner: ({ onScan, onClose }) => (
    <div role="dialog" aria-label="Scan coupon QR">
      <button type="button" onClick={() => onScan(globalThis.__nextScan)}>
        fake-scan
      </button>
      <button type="button" onClick={onClose}>
        fake-close
      </button>
    </div>
  ),
}));

import { redeemApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import RedeemPage from "./RedeemPage";

const CODE = "KM4T7QXH2P";
const coupon = (over = {}) => ({
  code: CODE,
  offerTitle: "20% off any haircut",
  terms: "One per visit",
  category: "Salon",
  customerFirstName: "Priya",
  issuedAt: "2026-11-10T06:00:00.000Z",
  expiresAt: "2026-12-10T06:00:00.000Z",
  status: "issued",
  needsPhoneCheck: false,
  ...over,
});
const TODAY_EMPTY = { scope: "mine", count: 0, redemptions: [] };

const render = (role = "employee") =>
  renderWith(<RedeemPage />, {
    session: makeSession({ role }),
    path: "/redeem",
  });
const codeInput = () => screen.getByLabelText("Coupon code");

async function lookUp(user, typed = "km4t7 qxh-2p") {
  await user.type(codeInput(), typed);
  await user.click(screen.getByRole("button", { name: "Check code" }));
}

beforeEach(() => {
  redeemApi.today.mockResolvedValue(TODAY_EMPTY);
});
afterEach(() => vi.clearAllMocks());

describe("Redeem — entering a code", () => {
  it("auto-uppercases and ignores spaces / dashes; shows it grouped for reading back", async () => {
    const user = userEvent.setup();
    render();
    await user.type(codeInput(), "km4t7 qxh-2p");
    expect(codeInput().value).toBe("KM4T7-QXH2P");
    await user.type(codeInput(), "EXTRA");
    expect(codeInput().value).toBe(
      "KM4T7-QXH2P",
      "never more than 10 characters",
    );
  });

  it("an incomplete code is caught before asking the server", async () => {
    const user = userEvent.setup();
    render();
    await lookUp(user, "KM4T7");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "10 letters and numbers",
    );
    expect(redeemApi.lookup).not.toHaveBeenCalled();
  });

  it("lookup preview: offer, terms, customer first name, expiry, valid badge — then confirm → success", async () => {
    redeemApi.lookup.mockResolvedValue(coupon());
    redeemApi.redeem.mockResolvedValue({
      ...coupon({ status: "redeemed" }),
      redeemedAt: "2026-11-12T05:12:00.000Z",
      redeemedByName: "Ravi Kumar",
    });
    const user = userEvent.setup();
    render();
    await lookUp(user);
    expect(redeemApi.lookup).toHaveBeenCalledWith(CODE);
    const preview = await screen.findByTestId("coupon-preview");
    expect(within(preview).getByText("20% off any haircut")).toBeTruthy();
    expect(within(preview).getByText("One per visit")).toBeTruthy();
    expect(within(preview).getByText("Priya")).toBeTruthy();
    expect(within(preview).getByText("10 Dec 2026")).toBeTruthy();
    expect(within(preview).getByText("Valid")).toBeTruthy();
    expect(screen.queryByLabelText(/Last 4 digits/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Confirm redeem" }));
    expect(redeemApi.redeem).toHaveBeenCalledWith(CODE, undefined);
    const done = await screen.findByRole("status");
    expect(done.textContent).toContain("Redeemed");
    expect(done.textContent).toContain("for Priya");
    expect(done.textContent).toContain("10:42");
    await waitFor(
      () => expect(redeemApi.today).toHaveBeenCalledTimes(2),
      "today's list refreshed",
    );

    await user.click(screen.getByRole("button", { name: "Redeem another" }));
    expect(codeInput().value).toBe("");
  });

  it("double-tapping Confirm sends ONE request", async () => {
    redeemApi.lookup.mockResolvedValue(coupon());
    let finish;
    redeemApi.redeem.mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    render();
    await lookUp(user);
    const confirm = await screen.findByRole("button", {
      name: "Confirm redeem",
    });
    await user.dblClick(confirm);
    await user.click(confirm);
    expect(redeemApi.redeem).toHaveBeenCalledTimes(1);
    finish({
      ...coupon({ status: "redeemed" }),
      redeemedAt: "2026-11-12T05:12:00.000Z",
    });
    expect(await screen.findByText("Redeemed")).toBeTruthy();
    expect(redeemApi.redeem).toHaveBeenCalledTimes(1);
  });

  it("phone check: the last-4 field appears only when needed, is required, and its digits are sent", async () => {
    redeemApi.lookup.mockResolvedValue(coupon({ needsPhoneCheck: true }));
    redeemApi.redeem.mockResolvedValue({
      ...coupon({ status: "redeemed" }),
      redeemedAt: "2026-11-12T05:12:00.000Z",
    });
    const user = userEvent.setup();
    render();
    await lookUp(user);
    const last4 = await screen.findByLabelText(
      "Last 4 digits of the customer's mobile",
    );
    await user.click(screen.getByRole("button", { name: "Confirm redeem" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Phone check needed",
    );
    expect(redeemApi.redeem).not.toHaveBeenCalled();
    await user.type(last4, "32a10");
    expect(last4.value).toBe("3210");
    await user.click(screen.getByRole("button", { name: "Confirm redeem" }));
    expect(redeemApi.redeem).toHaveBeenCalledWith(CODE, "3210");
  });

  it("phone mismatch: a clear message, and the same coupon can be tried again", async () => {
    redeemApi.lookup.mockResolvedValue(coupon({ needsPhoneCheck: true }));
    redeemApi.redeem.mockRejectedValueOnce(apiError(422, "PHONE_MISMATCH"));
    const user = userEvent.setup();
    render();
    await lookUp(user);
    await user.type(await screen.findByLabelText(/Last 4 digits/), "1111");
    await user.click(screen.getByRole("button", { name: "Confirm redeem" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Phone number doesn't match",
    );
    expect(screen.getByTestId("coupon-preview")).toBeTruthy();
  });
});

describe("Redeem — every refusal", () => {
  const cases = [
    [
      "already redeemed (who + when)",
      apiError(409, "COUPON_ALREADY_REDEEMED", "x", {
        redeemedAt: "2026-11-12T04:30:00.000Z",
        redeemedByName: "Meera Nair",
      }),
      ["Already redeemed", "Used 10:00", "12 Nov 2026", "by Meera Nair"],
    ],
    [
      "expired",
      apiError(410, "COUPON_EXPIRED", "x", {
        expiresAt: "2026-11-01T06:00:00.000Z",
      }),
      ["Expired", "expired on 1 Nov 2026"],
    ],
    [
      "void (order refunded)",
      apiError(409, "COUPON_VOID"),
      ["No longer valid", "refunded"],
    ],
    [
      "not found",
      apiError(404, "COUPON_NOT_FOUND"),
      ["Code not found", "Check the code with the customer"],
    ],
    [
      "rate-limited",
      apiError(429, "RATE_LIMITED"),
      ["Slow down", "Wait a moment"],
    ],
    [
      "locked out after wrong codes",
      apiError(429, "REDEEM_LOCKED"),
      ["Paused for 15 minutes"],
    ],
  ];
  for (const [label, err, texts] of cases) {
    it(`on redeem: ${label}`, async () => {
      redeemApi.lookup.mockResolvedValue(coupon());
      redeemApi.redeem.mockRejectedValue(err);
      const user = userEvent.setup();
      render();
      await lookUp(user);
      await user.click(
        await screen.findByRole("button", { name: "Confirm redeem" }),
      );
      const alert = await screen.findByRole("alert");
      for (const t of texts) expect(alert.textContent).toContain(t);
    });
  }

  it("on lookup: an unknown code says not found; the code stays for correcting", async () => {
    redeemApi.lookup.mockRejectedValue(apiError(404, "COUPON_NOT_FOUND"));
    const user = userEvent.setup();
    render();
    await lookUp(user);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Code not found",
    );
    expect(codeInput().value).toBe("KM4T7-QXH2P");
  });

  it("on lookup: an already-used / expired / void coupon is explained straight away, with no Confirm", async () => {
    for (const [status, extra, text] of [
      [
        "redeemed",
        {
          redeemedAt: "2026-11-12T04:30:00.000Z",
          redeemedByName: "Meera Nair",
        },
        "by Meera Nair",
      ],
      ["expired", {}, "expired on 10 Dec 2026"],
      ["void", {}, "refunded"],
    ]) {
      redeemApi.lookup.mockResolvedValueOnce(coupon({ status, ...extra }));
      const user = userEvent.setup();
      const r = render();
      await lookUp(user);
      expect((await screen.findByRole("alert")).textContent).toContain(text);
      expect(
        screen.queryByRole("button", { name: "Confirm redeem" }),
      ).toBeNull();
      r.unmount();
    }
  });
});

describe("Redeem — QR scanning", () => {
  it("a scanned QR fills the code and looks it up", async () => {
    redeemApi.lookup.mockResolvedValue(coupon());
    globalThis.__nextScan = "km4t7qxh2p";
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "Scan QR" }));
    await user.click(screen.getByRole("button", { name: "fake-scan" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(redeemApi.lookup).toHaveBeenCalledWith(CODE);
    expect(await screen.findByTestId("coupon-preview")).toBeTruthy();
  });

  it("a QR that isn't a coupon code is refused without a lookup", async () => {
    globalThis.__nextScan = "https://example.com/menu?table=4";
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "Scan QR" }));
    await user.click(screen.getByRole("button", { name: "fake-scan" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Not a Yulo coupon",
    );
    expect(redeemApi.lookup).not.toHaveBeenCalled();
  });

  it("closing the scanner returns to typing", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "Scan QR" }));
    await user.click(screen.getByRole("button", { name: "fake-close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(codeInput()).toBeTruthy();
  });
});

describe("Redeem — today's redemptions", () => {
  it("an employee's own list", async () => {
    redeemApi.today.mockResolvedValue({
      scope: "mine",
      count: 2,
      redemptions: [
        {
          code: "KM4T7QXH2P",
          offerTitle: "20% off any haircut",
          category: "Salon",
          customerFirstName: "Priya",
          redeemedAt: "2026-11-12T05:12:00.000Z",
          redeemedByName: "Ravi Kumar",
        },
        {
          code: "ABCDE23456",
          offerTitle: "Free wash",
          category: "Salon",
          customerFirstName: "Rahul",
          redeemedAt: "2026-11-12T04:00:00.000Z",
          redeemedByName: "Ravi Kumar",
        },
      ],
    });
    render();
    const list = await screen.findByRole("list", {
      name: "Today's redemptions",
    });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("10:42");
    expect(items[0].textContent).toContain("20% off any haircut");
    expect(items[0].textContent).toContain("Priya");
    expect(items[0].textContent).toContain("KM4T7-QXH2P");
    expect(items[0].textContent).not.toContain(
      "by Ravi",
      "an employee's own list doesn't repeat their name",
    );
  });

  it("the owner sees the whole business, with who redeemed each", async () => {
    redeemApi.today.mockResolvedValue({
      scope: "business",
      count: 1,
      redemptions: [
        {
          code: "KM4T7QXH2P",
          offerTitle: "20% off any haircut",
          category: "Salon",
          customerFirstName: "Priya",
          redeemedAt: "2026-11-12T05:12:00.000Z",
          redeemedByName: "Ravi Kumar",
        },
      ],
    });
    render("owner");
    expect(
      (await screen.findByRole("list", { name: "Today's redemptions" }))
        .textContent,
    ).toContain("by Ravi Kumar");
  });

  it("none yet", async () => {
    render();
    expect(
      await screen.findByText("You haven't redeemed any coupons today."),
    ).toBeTruthy();
  });
});

describe("Redeem — built for thumbs", () => {
  it("the main controls are at least 56px tall (h-14 / h-16)", async () => {
    render();
    expect(codeInput().className).toContain("h-16");
    for (const name of ["Scan QR", "Check code"])
      expect(screen.getByRole("button", { name }).className).toContain("h-14");
  });
});
