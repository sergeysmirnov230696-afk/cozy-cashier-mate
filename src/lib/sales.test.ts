import { describe, expect, it } from "vitest";
import { isSale, paymentSplit, salesRange, salesTotals } from "./sales";

describe("sales accounting", () => {
  it("counts paid orders before and after fulfilment, excluding reversals", () => {
    const orders = ["open", "completed", "paid", "cancelled", "refunded"].map((status) => ({ status, total: 1500, cash_amount: 1000, card_amount: 500 }));
    expect(salesTotals(orders)).toMatchObject({ count: 3, revenue: 4500, cash: 3000, card: 1500 });
    expect(isSale("unknown")).toBe(false);
  });
  it("includes cash deposits and withdrawals", () => {
    const totals = salesTotals([{ status: "completed", total: 1500, cash_amount: 1000, card_amount: 500 }], [{ type: "in", amount: 700 }, { type: "out", amount: 200 }]);
    expect(5000 + totals.cash + totals.cashIn - totals.cashOut).toBe(6500);
  });
  it("uses Almaty midnight and inclusive calendar periods", () => {
    const now = new Date("2026-10-24T07:54:00Z");
    expect(salesRange("today", now)).toEqual({ from: "2026-10-23T19:00:00.000Z", to: "2026-10-24T19:00:00.000Z" });
    expect(salesRange("week", now).from).toBe("2026-10-17T19:00:00.000Z");
    expect(salesRange("month", now).from).toBe("2026-09-24T19:00:00.000Z");
  });
  it("corrects cash payment and change without changing the total", () => {
    expect(paymentSplit(1500, "cash", 0, 2000)).toEqual({ cashAmount: 1500, cardAmount: 0, cashReceived: 2000, changeGiven: 500 });
  });
  it("clears cash and change on correction to card", () => {
    expect(paymentSplit(1500, "card", 0, 2000)).toEqual({ cashAmount: 0, cardAmount: 1500, cashReceived: 0, changeGiven: 0 });
  });
  it("splits mixed payments and rejects insufficient cash", () => {
    expect(paymentSplit(1500, "mixed", 500, 1200)).toEqual({ cashAmount: 1000, cardAmount: 500, cashReceived: 1200, changeGiven: 200 });
    expect(() => paymentSplit(1500, "mixed", 1600, 0)).toThrow();
    expect(() => paymentSplit(1500, "cash", 0, 1000)).toThrow();
  });
});