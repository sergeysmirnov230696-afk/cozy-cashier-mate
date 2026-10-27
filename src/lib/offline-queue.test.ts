import { beforeEach, describe, expect, it } from "vitest";
import { enqueueOrder, getQueue, loadCashier, markQueueError, removeQueued, saveCashier } from "./offline-queue";
import type { CreateOrderInputLike } from "./offline-types";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
  dispatchEvent: () => true,
} });
const payload: CreateOrderInputLike = {
  clientOrderId: "800a9b48-97c0-43b1-bc01-dbd7a1b505aa", shiftId: "original-shift", employeeId: "original-cashier",
  lines: [{ productId: "weighted-product", qty: 0.25, modifierIds: [] }],
  discountPercent: 0, discountAmount: 0, paymentMethod: "mixed", cashReceived: 500, cardAmount: 250,
  orderType: "takeaway", bonusUsed: 0, expectedTotal: 750,
};
beforeEach(() => storage.clear());
describe("offline payments", () => {
  it("reuses the same queued payment UUID on retries", () => {
    enqueueOrder(payload); enqueueOrder(payload);
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0]?.payload.clientOrderId).toBe(payload.clientOrderId);
  });
  it("retains rejected paid sales with their error", () => {
    const q = enqueueOrder(payload); markQueueError(q.localId, "Смена закрыта");
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0]?.error).toBe("Смена закрыта");
  });
  it("preserves original shift, cashier, fractional weight and paid total", () => {
    enqueueOrder(payload);
    expect(getQueue()[0]?.payload).toMatchObject({ shiftId: "original-shift", employeeId: "original-cashier", expectedTotal: 750, lines: [{ qty: 0.25 }] });
  });
  it("removes only the acknowledged payment", () => {
    const q = enqueueOrder(payload); enqueueOrder({ ...payload, clientOrderId: "9812a4fb-23ea-4fbc-bd5e-a2acfdedec1a" });
    removeQueued(q.localId);
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0]?.localId).toBe("9812a4fb-23ea-4fbc-bd5e-a2acfdedec1a");
  });
  it("expires cached cashier identity after 24 hours", () => {
    saveCashier({ loginAt: new Date(Date.now() - 86_400_000).toISOString() });
    expect(loadCashier()).toBeNull();
  });
});