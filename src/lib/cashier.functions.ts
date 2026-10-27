import { createServerFn } from "@tanstack/react-start";
import { isSale } from "@/lib/sales";

/**
 * Все действия кассы. Кассир не является пользователем базы: он входит по PIN,
 * а сервер сам проверяет сессию и считает суммы, поэтому цены и остатки нельзя
 * подменить со стороны планшета.
 */

export type CashierInfo = { id: string; name: string; role: string; loginAt: string };

export type OrderStatus = "open" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "card" | "mixed";
export type OrderType = "takeaway" | "dinein" | "delivery";

export type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
  total: number;
  modifiers: { name: string; price: number }[];
};

export type ReceiptPayload = {
  orderId: string;
  offlineNo?: number;
  orderNo: number;
  dailyNo: number;
  createdAt: string;
  status: OrderStatus;
  orderType: OrderType;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  cashReceived: number;
  changeGiven: number;
  bonusEarned: number;
  bonusUsed: number;
  fiscalNumber: string | null;
  fiscalCheckUrl: string | null;
  shop: {
    name: string;
    address: string;
    phone: string;
    footer: string;
    vatPercent: number;
  };
};

export type CartLineInput = {
  productId: string;
  qty: number;
  modifierIds: string[];
};

/** Список кассиров для экрана входа — только имена, без PIN. */
export const listCashiers = createServerFn({ method: "GET" }).handler(async () => {
  const { db, closeExpiredShifts } = await import("@/lib/cashier.server");
  await closeExpiredShifts();
  const { data } = await db
    .from("employees")
    .select("id, name, role, locked_until")
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((e: Record<string, unknown>) => ({
    id: String(e["id"]),
    name: String(e["name"]),
    role: String(e["role"]),
    lockedUntil: (e["locked_until"] as string | null) ?? null,
  }));
});

export const cashierMe = createServerFn({ method: "GET" }).handler(
  async (): Promise<CashierInfo | null> => {
    const { readCashier } = await import("@/lib/cashier.server");
    return readCashier();
  },
);

export const cashierLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { employeeId: string; pin: string }) => input)
  .handler(async ({ data }) => {
    const { db, cashierSession, logAction, closeExpiredShifts } = await import(
      "@/lib/cashier.server"
    );
    await closeExpiredShifts();

    const { data: employee } = await db
      .from("employees")
      .select("id, name, role, pin, is_active, pin_attempts, locked_until")
      .eq("id", data.employeeId)
      .maybeSingle();

    if (!employee || employee.is_active === false) {
      return { ok: false as const, message: "Сотрудник не найден" };
    }

    if (employee.locked_until && new Date(employee.locked_until).getTime() > Date.now()) {
      return { ok: false as const, message: "Вход заблокирован, попробуйте через 5 минут" };
    }

    if (String(employee.pin) !== data.pin.trim()) {
      const attempts = Number(employee.pin_attempts ?? 0) + 1;
      const locked = attempts >= 5;
      await db
        .from("employees")
        .update({
          pin_attempts: locked ? 0 : attempts,
          locked_until: locked ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
        })
        .eq("id", employee.id);
      await logAction({ id: String(employee.id), name: String(employee.name) }, "pin_failed", "employee", String(employee.id), { attempts });
      return {
        ok: false as const,
        message: locked
          ? "5 неверных попыток. Вход закрыт на 5 минут"
          : `Неверный PIN. Осталось попыток: ${5 - attempts}`,
      };
    }

    await db
      .from("employees")
      .update({ pin_attempts: 0, locked_until: null })
      .eq("id", employee.id);

    const session = await cashierSession();
    await session.update({
      employeeId: String(employee.id),
      name: String(employee.name),
      role: String(employee.role),
      loginAt: new Date().toISOString(),
    });

    await logAction(
      { id: String(employee.id), name: String(employee.name) },
      "login",
      "employee",
      String(employee.id),
    );

    return { ok: true as const, name: String(employee.name) };
  });

export const cashierLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { cashierSession, readCashier, logAction } = await import("@/lib/cashier.server");
  const cashier = await readCashier();
  if (cashier) await logAction(cashier, "logout", "employee", cashier.id);
  const session = await cashierSession();
  await session.clear();
  return { ok: true as const };
});

/** Всё, что нужно экрану продаж: меню, добавки, настройки, смена, остатки. */
export const getPosData = createServerFn({ method: "GET" }).handler(async () => {
  const { db, requireCashier, openShiftRow, getSettingsRow } = await import(
    "@/lib/cashier.server"
  );
  const cashier = await requireCashier();

  const [categories, products, modifiers, discounts, settings, shift] = await Promise.all([
    db.from("categories").select("*").order("sort"),
    db.from("products").select("*").eq("is_active", true).order("sort"),
    db.from("modifiers").select("*").eq("is_active", true).order("price"),
    db.from("discounts").select("*").eq("is_active", true).order("value"),
    getSettingsRow(),
    openShiftRow(),
  ]);

  const threshold = Number(settings?.low_stock_threshold ?? 5);
  const lowStock = (products.data ?? [])
    .filter((p: Record<string, unknown>) => p["track_stock"] && Number(p["stock"]) <= threshold)
    .map((p: Record<string, unknown>) => ({
      id: String(p["id"]),
      name: String(p["name"]),
      stock: Number(p["stock"]),
    }));

  let openOrders = 0;
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  openOrders = count ?? 0;

  return {
    cashier,
    categories: categories.data ?? [],
    products: products.data ?? [],
    modifiers: modifiers.data ?? [],
    discounts: discounts.data ?? [],
    settings,
    shift,
    lowStock,
    openOrders,
  };
});

export const openShift = createServerFn({ method: "POST" })
  .inputValidator((input: { cashStart: number }) => input)
  .handler(async ({ data }) => {
    const { db, requireCashier, openShiftRow, logAction } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();

    const existing = await openShiftRow();
    if (existing) {
      return {
        ok: false as const,
        message: "Уже есть открытая смена. Сначала закройте её.",
      };
    }

    const { data: shift, error } = await db
      .from("shifts")
      .insert({
        employee_id: cashier.id,
        cash_start: Math.max(0, Math.round(data.cashStart)),
        status: "open",
      })
      .select("*")
      .single();

    if (error) return { ok: false as const, message: error.message };
    await logAction(cashier, "shift_open", "shift", String(shift.id), {
      cash_start: shift.cash_start,
    });
    return { ok: true as const, shift };
  });

async function shiftTotals(shiftId: string) {
  const { db } = await import("@/lib/cashier.server");
  const [{ data: orders }, { data: ops }] = await Promise.all([
    db.from("orders").select("*").eq("shift_id", shiftId),
    db.from("cash_operations").select("*").eq("shift_id", shiftId),
  ]);

  const paid = (orders ?? []).filter(
    (o: Record<string, unknown>) => isSale(String(o["status"])),
  );
  const sum = (key: string) =>
    paid.reduce((acc: number, o: Record<string, unknown>) => acc + Number(o[key] ?? 0), 0);

  const cashIn = (ops ?? [])
    .filter((o: Record<string, unknown>) => o["type"] === "in")
    .reduce((a: number, o: Record<string, unknown>) => a + Number(o["amount"] ?? 0), 0);
  const cashOut = (ops ?? [])
    .filter((o: Record<string, unknown>) => o["type"] === "out")
    .reduce((a: number, o: Record<string, unknown>) => a + Number(o["amount"] ?? 0), 0);

  return {
    ordersCount: paid.length,
    cancelledCount: (orders ?? []).length - paid.length,
    salesTotal: sum("total"),
    discountTotal: sum("discount"),
    cashTotal: sum("cash_amount"),
    cardTotal: sum("card_amount"),
    cashIn,
    cashOut,
  };
}

/** X-отчёт: показатели текущей смены без её закрытия. */
export const shiftReport = createServerFn({ method: "GET" }).handler(async () => {
  const { requireCashier, openShiftRow } = await import("@/lib/cashier.server");
  await requireCashier();
  const shift = await openShiftRow();
  if (!shift) return null;
  const totals = await shiftTotals(String(shift.id));
  const expectedCash = Number(shift.cash_start ?? 0) + totals.cashTotal + totals.cashIn - totals.cashOut;
  return { shift, totals, expectedCash };
});

/** Z-отчёт: закрывает смену и показывает итог с расхождением по кассе. */
export const closeShift = createServerFn({ method: "POST" })
  .inputValidator((input: { countedCash: number; note?: string }) => input)
  .handler(async ({ data }) => {
    const { db, requireCashier, openShiftRow, logAction } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();
    const shift = await openShiftRow();
    if (!shift) return { ok: false as const, message: "Открытой смены нет" };

    const { count: openOrders } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shift.id)
      .eq("status", "open");
    if ((openOrders ?? 0) > 0) {
      return {
        ok: false as const,
        message: `Нельзя закрыть смену: ${openOrders} заказ(ов) ещё открыты`,
      };
    }

    const totals = await shiftTotals(String(shift.id));
    const expectedCash =
      Number(shift.cash_start ?? 0) + totals.cashTotal + totals.cashIn - totals.cashOut;
    const counted = Math.round(data.countedCash);

    const { data: closed, error } = await db
      .from("shifts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        cash_end: counted,
        expected_cash: expectedCash,
        cash_diff: counted - expectedCash,
        sales_total: totals.salesTotal,
        orders_count: totals.ordersCount,
        note: data.note ?? null,
      })
      .eq("id", shift.id)
      .select("*")
      .single();

    if (error) return { ok: false as const, message: error.message };
    await logAction(cashier, "shift_close", "shift", String(shift.id), {
      expected: expectedCash,
      counted,
      diff: counted - expectedCash,
    });
    return { ok: true as const, shift: closed, totals, expectedCash, counted };
  });

/** Внесение/изъятие наличных из кассы. */
export const addCashOperation = createServerFn({ method: "POST" })
  .inputValidator((input: { type: "in" | "out"; amount: number; reason: string }) => input)
  .handler(async ({ data }) => {
    const { db, requireCashier, openShiftRow, logAction } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();
    const shift = await openShiftRow();
    if (!shift) return { ok: false as const, message: "Сначала откройте смену" };
    if (!Number.isFinite(data.amount) || data.amount <= 0)
      return { ok: false as const, message: "Введите сумму" };

    await db.from("cash_operations").insert({
      shift_id: shift.id,
      employee_id: cashier.id,
      type: data.type,
      amount: Math.round(data.amount),
      reason: data.reason || null,
    });
    await logAction(cashier, data.type === "in" ? "cash_in" : "cash_out", "shift", String(shift.id), {
      amount: Math.round(data.amount),
      reason: data.reason,
    });
    return { ok: true as const };
  });

export const findCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const { db, requireCashier } = await import("@/lib/cashier.server");
    await requireCashier();
    const phone = data.phone.replace(/\s+/g, "");
    if (phone.length < 5) return null;
    const { data: customer } = await db
      .from("customers")
      .select("id, name, phone, bonus, visits, total_spent")
      .eq("phone", phone)
      .maybeSingle();
    return customer ?? null;
  });

type CreateOrderInput = {
  clientOrderId?: string;
  employeeId?: string;
  shiftId?: string;
  soldAt?: string;
  expectedTotal?: number;
  lines: CartLineInput[];
  discountPercent?: number;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  cardAmount?: number;
  orderType: OrderType;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  bonusUsed?: number;
};

function isWeightUnit(product: Record<string, unknown> | null | undefined): boolean {
  const unit = String(product?.["unit"] ?? "").trim().toLowerCase();
  return unit === "кг" || unit === "kg";
}

/** Создаёт заказ со статусом «открыт», списывает остатки, считает бонусы. */
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input: CreateOrderInput) => input)
  .handler(async ({ data }): Promise<{ ok: false; message: string } | { ok: true; receipt: ReceiptPayload }> => {
    const { db, requireCashier, openShiftRow, getSettingsRow, logAction } = await import(
      "@/lib/cashier.server"
    );
    const cashier = await requireCashier();
    if (data.clientOrderId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.clientOrderId))
      return { ok: false, message: "Некорректный номер офлайн-заказа" };
    if (data.employeeId && data.employeeId !== cashier.id)
      return { ok: false, message: "Войдите как кассир, принявший этот заказ" };
    if (data.clientOrderId) {
      const { data: existing, error: lookupError } = await db.from("orders").select("employee_id, client_receipt").eq("client_order_id", data.clientOrderId).maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (existing) {
        if (existing.employee_id !== cashier.id) return { ok: false, message: "Заказ другого кассира" };
        return { ok: true, receipt: existing.client_receipt as ReceiptPayload };
      }
    }
    const shift = await openShiftRow();
    if (!shift) return { ok: false, message: "Сначала откройте смену" };
    if (data.shiftId && data.shiftId !== String(shift.id))
      return { ok: false, message: "Исходная смена закрыта. Заказ сохранён на кассе — требуется разбор администратором" };
    if (!data.lines.length) return { ok: false, message: "Корзина пуста" };

    const productIds = [...new Set(data.lines.map((l) => l.productId))];
    const modifierIds = [...new Set(data.lines.flatMap((l) => l.modifierIds))];

    const [{ data: products }, { data: modifiers }, settings] = await Promise.all([
      db.from("products").select("*").in("id", productIds),
      modifierIds.length
        ? db.from("modifiers").select("*").in("id", modifierIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      getSettingsRow(),
    ]);

    const productMap = new Map(
      (products ?? []).map((p: Record<string, unknown>) => [String(p["id"]), p]),
    );
    const modifierMap = new Map(
      (modifiers ?? []).map((m: Record<string, unknown>) => [String(m["id"]), m]),
    );

    const items: ReceiptItem[] = [];
    const itemRows: Record<string, unknown>[] = [];
    let subtotal = 0;

    for (const line of data.lines) {
      const product = productMap.get(line.productId);
      if (!product) return { ok: false, message: "Товар не найден" };
      if (product["in_stop_list"])
        return { ok: false, message: `«${String(product["name"])}» в стоп-листе` };

      const soldByWeight = isWeightUnit(product);
      const qty = soldByWeight
        ? Math.max(0.001, Math.round(line.qty * 1000) / 1000)
        : Math.max(1, Math.round(line.qty));
      const mods = line.modifierIds
        .map((id) => modifierMap.get(id))
        .filter((m): m is Record<string, unknown> => Boolean(m))
        .map((m) => ({ name: String(m["name"]), price: Number(m["price"] ?? 0) }));

      const unit = Number(product["price"] ?? 0) + mods.reduce((a, m) => a + m.price, 0);
      const total = Math.round(unit * qty);
      subtotal += total;

      items.push({ name: String(product["name"]), qty, price: unit, total, modifiers: mods });
      itemRows.push({
        product_id: line.productId,
        name: String(product["name"]),
        price: unit,
        qty,
        modifiers: mods,
        total,
      });
    }

    // Скидка и бонусы считаются на сервере
    const percent = Math.min(100, Math.max(0, Number(data.discountPercent ?? 0)));
    let discount = Math.round((subtotal * percent) / 100) + Math.max(0, Math.round(data.discountAmount ?? 0));
    discount = Math.min(discount, subtotal);

    let customer: Record<string, unknown> | null = null;
    const phone = (data.customerPhone ?? "").replace(/\s+/g, "");
    if (phone.length >= 5) {
      const { data: found } = await db
        .from("customers")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      customer = found ?? null;
    }

    let bonusUsed = Math.max(0, Math.round(data.bonusUsed ?? 0));
    if (!customer) bonusUsed = 0;
    else bonusUsed = Math.min(bonusUsed, Number(customer["bonus"] ?? 0), subtotal - discount);

    const total = Math.max(0, subtotal - discount - bonusUsed);
    if (data.expectedTotal !== undefined && data.expectedTotal !== total)
      return { ok: false, message: "Цена или бонусы изменились. Заказ сохранён — требуется проверка суммы" };

    const cashReceived = Math.max(0, Math.round(data.cashReceived ?? 0));
    const cardAmount =
      data.paymentMethod === "card"
        ? total
        : data.paymentMethod === "mixed"
          ? Math.min(total, Math.max(0, Math.round(data.cardAmount ?? 0)))
          : 0;
    const cashAmount = Math.max(0, total - cardAmount);
    if (data.paymentMethod !== "card" && cashReceived < cashAmount)
      return { ok: false, message: "Наличных меньше суммы к оплате" };
    const changeGiven = data.paymentMethod === "card" ? 0 : Math.max(0, cashReceived - cashAmount);

    const bonusPercent = Number(settings?.bonus_percent ?? 0);
    const bonusEarned = customer && bonusPercent > 0 ? Math.floor((total * bonusPercent) / 100) : 0;

    const orderRow = {
        shift_id: shift.id,
        employee_id: cashier.id,
        subtotal,
        discount: discount + bonusUsed,
        total,
        payment_method: data.paymentMethod,
        cash_amount: cashAmount,
        card_amount: cardAmount,
        cash_received: cashReceived,
        change_given: changeGiven,
        status: "open",
        order_type: data.orderType,
        customer_name: data.customerName || null,
        customer_phone: phone || null,
        customer_id: customer ? customer["id"] : null,
        bonus_earned: bonusEarned,
        bonus_used: bonusUsed,
        note: data.note || null,
        ...(data.soldAt ? { created_at: data.soldAt } : {}),
      };

    // Списание остатков по товарам с учётом склада
    const stockRows = data.lines
      .map((line) => ({ line, product: productMap.get(line.productId) }))
      .filter(({ product }) => product && product["track_stock"])
      .map(({ line, product }) => ({
        product_id: line.productId,
        qty:
          product && isWeightUnit(product)
            ? -Math.round(line.qty * 1000) / 1000
            : -Math.max(1, Math.round(line.qty)),
        type: "sale",
      }));

    const receiptBase = {
      status: "open", orderType: data.orderType, cashierName: cashier.name,
      customerName: data.customerName || null, customerPhone: phone || null, note: data.note || null,
      items, subtotal, discount: discount + bonusUsed, total, paymentMethod: data.paymentMethod,
      cashAmount, cardAmount, cashReceived, changeGiven, bonusEarned, bonusUsed,
      fiscalNumber: null, fiscalCheckUrl: null,
      shop: { name: String(settings?.shop_name ?? "Гриль & Донер"), address: String(settings?.address ?? ""), phone: String(settings?.phone ?? ""), footer: String(settings?.receipt_footer ?? ""), vatPercent: Number(settings?.vat_percent ?? 0) },
    };
    const { data: committed, error } = await db.rpc("commit_cashier_sale", {
      p_key: data.clientOrderId ?? null, p_order: orderRow, p_items: itemRows,
      p_stock: stockRows, p_customer: { name: data.customerName || null }, p_receipt: receiptBase,
    });
    if (error || !committed) return { ok: false, message: error?.message ?? "Не удалось создать заказ" };
    const receipt = committed.receipt as ReceiptPayload;
    if (committed.replay) return { ok: true, receipt };

    // Фискализация через Kaspi, если включена в настройках
    let fiscalNumber: string | null = null;
    let fiscalCheckUrl: string | null = null;
    try {
      const { fiscalize } = await import("@/lib/kaspi.server");
      const res = await fiscalize(db, {
        orderId: receipt.orderId,
        orderNo: receipt.dailyNo,
        amount: total,
        method: data.paymentMethod,
        cashAmount,
        cardAmount,
      });
      fiscalNumber = res.fiscalNumber ?? null;
      fiscalCheckUrl = res.checkUrl ?? null;
    } catch {
      // Печать чеков не должна зависеть от терминала
    }

    receipt.fiscalNumber = fiscalNumber;
    receipt.fiscalCheckUrl = fiscalCheckUrl;
    await db.from("orders").update({ client_receipt: receipt }).eq("id", receipt.orderId);
    return { ok: true, receipt };
  });

/** Заказы за сегодня с позициями — для экрана статусов. */
export const listCashierOrders = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: OrderStatus | "all" } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { db, requireCashier } = await import("@/lib/cashier.server");
    await requireCashier();

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    let query = db
      .from("orders")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "all") query = query.eq("status", data.status);

    const { data: orders } = await query;
    const ids = (orders ?? []).map((o: Record<string, unknown>) => o["id"]);
    const { data: items } = ids.length
      ? await db.from("order_items").select("*").in("order_id", ids)
      : { data: [] as Record<string, unknown>[] };

    return (orders ?? []).map((o: Record<string, unknown>) => ({
      ...o,
      items: (items ?? []).filter((i: Record<string, unknown>) => i["order_id"] === o["id"]),
    }));
  });

/** Перевод заказа в «выполнен» или «отменён». Отмена возвращает остатки и бонусы. */
export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; status: OrderStatus; reason?: string }) => input)
  .handler(async ({ data }) => {
    const { db, requireCashier, logAction } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();

    const { data: order } = await db.from("orders").select("*").eq("id", data.orderId).maybeSingle();
    if (!order) return { ok: false as const, message: "Заказ не найден" };
    if (order.status === data.status) return { ok: true as const };
    if (order.status === "cancelled")
      return { ok: false as const, message: "Отменённый заказ изменить нельзя" };

    if (data.status === "completed") {
      await db
        .from("orders")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", order.id);
      await logAction(cashier, "order_completed", "order", String(order.id), {
        daily_no: order.daily_no,
      });
      return { ok: true as const };
    }

    if (data.status === "cancelled") {
      if (!data.reason || data.reason.trim().length < 3)
        return { ok: false as const, message: "Укажите причину отмены" };

      const { data: items } = await db
        .from("order_items")
        .select("product_id, qty")
        .eq("order_id", order.id);

      const productIds = (items ?? [])
        .map((i: Record<string, unknown>) => i["product_id"])
        .filter(Boolean);
      const { data: products } = productIds.length
        ? await db.from("products").select("id, track_stock").in("id", productIds)
        : { data: [] as Record<string, unknown>[] };
      const tracked = new Set(
        (products ?? [])
          .filter((p: Record<string, unknown>) => p["track_stock"])
          .map((p: Record<string, unknown>) => String(p["id"])),
      );

      const returns = (items ?? [])
        .filter((i: Record<string, unknown>) => tracked.has(String(i["product_id"])))
        .map((i: Record<string, unknown>) => ({
          product_id: i["product_id"],
          qty: Number(i["qty"] ?? 0),
          type: "return",
          note: `Отмена заказа №${order.daily_no}`,
        }));
      if (returns.length) await db.from("stock_movements").insert(returns);

      if (order.customer_id) {
        const { data: customer } = await db
          .from("customers")
          .select("*")
          .eq("id", order.customer_id)
          .maybeSingle();
        if (customer) {
          await db
            .from("customers")
            .update({
              bonus:
                Number(customer["bonus"] ?? 0) -
                Number(order.bonus_earned ?? 0) +
                Number(order.bonus_used ?? 0),
              total_spent: Math.max(
                0,
                Number(customer["total_spent"] ?? 0) - Number(order.total ?? 0),
              ),
              visits: Math.max(0, Number(customer["visits"] ?? 0) - 1),
            })
            .eq("id", customer["id"]);
        }
      }

      await db
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: data.reason.trim(),
          cancelled_by: cashier.id,
        })
        .eq("id", order.id);

      await logAction(cashier, "order_cancelled", "order", String(order.id), {
        daily_no: order.daily_no,
        reason: data.reason.trim(),
      });
      return { ok: true as const };
    }

    return { ok: false as const, message: "Неизвестный статус" };
  });

/** Повторная печать чека из истории. */
export const reprintOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string }) => input)
  .handler(async ({ data }): Promise<ReceiptPayload | null> => {
    const { db, requireCashier, getSettingsRow, logAction } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();

    const [{ data: order }, settings] = await Promise.all([
      db.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
      getSettingsRow(),
    ]);
    if (!order) return null;

    const [{ data: items }, { data: employee }] = await Promise.all([
      db.from("order_items").select("*").eq("order_id", order.id),
      db.from("employees").select("name").eq("id", order.employee_id).maybeSingle(),
    ]);

    await logAction(cashier, "receipt_reprint", "order", String(order.id), {
      daily_no: order.daily_no,
    });

    return {
      orderId: String(order.id),
      orderNo: Number(order.order_no),
      dailyNo: Number(order.daily_no ?? 0),
      createdAt: String(order.created_at),
      status: order.status as OrderStatus,
      orderType: (order.order_type ?? "takeaway") as OrderType,
      cashierName: String(employee?.name ?? ""),
      customerName: order.customer_name ?? null,
      customerPhone: order.customer_phone ?? null,
      note: order.note ?? null,
      items: (items ?? []).map((i: Record<string, unknown>) => ({
        name: String(i["name"]),
        qty: Number(i["qty"]),
        price: Number(i["price"]),
        total: Number(i["total"]),
        modifiers: (i["modifiers"] as { name: string; price: number }[]) ?? [],
      })),
      subtotal: Number(order.subtotal ?? 0),
      discount: Number(order.discount ?? 0),
      total: Number(order.total ?? 0),
      paymentMethod: (order.payment_method ?? "cash") as PaymentMethod,
      cashAmount: Number(order.cash_amount ?? 0),
      cardAmount: Number(order.card_amount ?? 0),
      cashReceived: Number(order.cash_received ?? 0),
      changeGiven: Number(order.change_given ?? 0),
      bonusEarned: Number(order.bonus_earned ?? 0),
      bonusUsed: Number(order.bonus_used ?? 0),
      fiscalNumber: order.fiscal_number ?? null,
      fiscalCheckUrl: order.fiscal_check_url ?? null,
      shop: {
        name: String(settings?.shop_name ?? "Гриль & Донер"),
        address: String(settings?.address ?? ""),
        phone: String(settings?.phone ?? ""),
        footer: String(settings?.receipt_footer ?? ""),
        vatPercent: Number(settings?.vat_percent ?? 0),
      },
    };
  });

/** Публичная доска заказов для зала: только номера и статус. */
export const publicOrderBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { db, getSettingsRow } = await import("@/lib/cashier.server");
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [{ data: orders }, settings] = await Promise.all([
    db
      .from("orders")
      .select("daily_no, status, created_at, completed_at")
      .gte("created_at", since.toISOString())
      .in("status", ["open", "completed"])
      .order("daily_no", { ascending: true }),
    getSettingsRow(),
  ]);

  return {
    shopName: String(settings?.shop_name ?? "Гриль & Донер"),
    cooking: (orders ?? [])
      .filter((o: Record<string, unknown>) => o["status"] === "open")
      .map((o: Record<string, unknown>) => Number(o["daily_no"])),
    ready: (orders ?? [])
      .filter((o: Record<string, unknown>) => o["status"] === "completed")
      .slice(-12)
      .map((o: Record<string, unknown>) => Number(o["daily_no"])),
  };
});
