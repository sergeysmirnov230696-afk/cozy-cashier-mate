export type SalesPeriod = "today" | "week" | "month";

export function isSale(status: string) {
  return ["open", "completed", "paid"].includes(status);
}

// Business day is Almaty (UTC+5), independent of the device timezone.
export function salesRange(period: SalesPeriod, now = new Date()) {
  const offset = 5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const days = period === "week" ? 7 : period === "month" ? 30 : 1;
  return {
    from: new Date(start - offset - (days - 1) * 86400000).toISOString(),
    to: new Date(start - offset + 86400000).toISOString(),
  };
}

export function paymentSplit(total: number, method: string, card: number, received: number) {
  if (!["cash", "card", "mixed"].includes(method)) throw new Error("Неизвестный способ оплаты");
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Некорректная сумма чека");
  const cardAmount = method === "card" ? total : method === "cash" ? 0 : card;
  if (!Number.isSafeInteger(cardAmount) || cardAmount < 0 || cardAmount > total)
    throw new Error("Сумма по карте должна быть от 0 до суммы чека");
  const cashAmount = total - cardAmount;
  const cashReceived = method === "card" ? 0 : received;
  if (!Number.isSafeInteger(cashReceived) || cashReceived < cashAmount)
    throw new Error("Наличных меньше суммы к оплате");
  return { cashAmount, cardAmount, cashReceived, changeGiven: cashReceived - cashAmount };
}

export function salesTotals(orders: { status: string; total: number; cash_amount: number; card_amount: number }[], ops: { type: string; amount: number }[] = []) {
  const sales = orders.filter((o) => isSale(o.status));
  const cashIn = ops.filter((o) => o.type === "in").reduce((sum, o) => sum + o.amount, 0);
  const cashOut = ops.filter((o) => o.type === "out").reduce((sum, o) => sum + o.amount, 0);
  return {
    count: sales.length,
    revenue: sales.reduce((sum, o) => sum + o.total, 0),
    cash: sales.reduce((sum, o) => sum + o.cash_amount, 0),
    card: sales.reduce((sum, o) => sum + o.card_amount, 0),
    cashIn, cashOut,
  };
}