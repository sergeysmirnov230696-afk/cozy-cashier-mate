import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, RotateCcw, Pencil } from "lucide-react";
import { isSale, salesTotals } from "@/lib/sales";
import { PaymentCorrection } from "@/components/pos/PaymentCorrection";
import { ReportPeriod, useReportPeriod } from "@/components/pos/ReportPeriod";
import { supabase } from "@/integrations/supabase/client";
import {
  employeesQuery,
  ordersQuery,
  settingsQuery,
  shiftsQuery,
  type Order,
  type OrderItem,
} from "@/lib/pos-queries";
import { formatDateTime, formatKzt, formatTime, PAYMENT_LABELS } from "@/lib/pos";
import { Receipt, type ReceiptData } from "@/components/pos/Receipt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Чеки и смены — касса точки" },
      {
        name: "description",
        content: "История чеков, возвраты продаж, X- и Z-отчёты по сменам кассиров.",
      },
      { property: "og:title", content: "Чеки и смены — касса точки" },
      { property: "og:description", content: "История продаж, возвраты и отчёты по сменам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"orders" | "shifts">("orders");
  const selection = useReportPeriod();
  const { from, to } = selection.range;

  const orders = useQuery(ordersQuery(from, to));
  const employees = useQuery(employeesQuery);
  const settings = useQuery(settingsQuery);
  const shifts = useQuery(shiftsQuery);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [shiftReport, setShiftReport] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

  const employeeName = (id: string | null) =>
    (employees.data ?? []).find((e) => e.id === id)?.name ?? "—";

  const openReceipt = useMutation({
    mutationFn: async (order: Order) => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);
      if (error) throw new Error(error.message);
      return { order, items: (data ?? []) as OrderItem[] };
    },
    onSuccess: ({ order, items }) => {
      setReceipt({
        orderNo: order.order_no,
        createdAt: order.created_at,
        cashier: employeeName(order.employee_id),
        lines: items.map((i) => ({
          name: i.name,
          qty: Number(i.qty),
          price: i.price,
          total: i.total,
          extra:
            (Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [])
              .map((m) => m.name)
              .join(", ") || undefined,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.payment_method,
        cashAmount: order.cash_amount,
        cardAmount: order.card_amount,
        cashReceived: order.cash_received,
        change: order.change_given,
        refunded: order.status === "refunded" || order.status === "cancelled",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: async (order: Order) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", order.id);
      if (error) throw new Error(error.message);

      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, qty")
        .eq("order_id", order.id);
      const moves = (items ?? [])
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          qty: Number(i.qty),
          type: "refund",
          note: `Возврат по чеку №${order.order_no}`,
        }));
      if (moves.length) await supabase.from("stock_movements").insert(moves);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Возврат оформлен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = orders.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Чеки и смены</h1>
        <Button size="sm" variant={tab === "orders" ? "default" : "secondary"} onClick={() => setTab("orders")}>
          Чеки
        </Button>
        <Button size="sm" variant={tab === "shifts" ? "default" : "secondary"} onClick={() => setTab("shifts")}>
          Смены
        </Button>
      </div>

      {tab === "orders" && (
        <>
          {orders.isError && <p role="alert" className="text-destructive">{orders.error.message}</p>}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Сегодня"],
                ["week", "7 дней"],
                ["month", "30 дней"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={period === k ? "default" : "secondary"}
                onClick={() => setPeriod(k)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">№</th>
                  <th className="p-3">Время</th>
                  <th className="p-3">Кассир</th>
                  <th className="p-3">Оплата</th>
                  <th className="p-3 text-right">Сумма</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Чеков за период нет
                    </td>
                  </tr>
                )}
                {list.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{o.order_no}</td>
                    <td className="p-3">{formatDateTime(o.created_at)}</td>
                    <td className="p-3">{employeeName(o.employee_id)}</td>
                    <td className="p-3">{PAYMENT_LABELS[o.payment_method] ?? o.payment_method}</td>
                    <td className="p-3 text-right font-semibold">{formatKzt(o.total)}</td>
                    <td className="p-3">
                      {o.status === "refunded" || o.status === "cancelled" ? (
                        <span className="text-destructive">
                          {o.status === "refunded" ? "Возврат" : "Отменён"}
                        </span>
                      ) : o.status === "open" ? (
                        <span className="text-primary">Открыт</span>
                      ) : (
                        <span className="text-secondary">Выполнен</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {isSale(o.status) && <Button size="sm" variant="secondary" title="Изменить способ оплаты" aria-label={`Изменить оплату чека №${o.order_no}`} onClick={() => setPaymentOrder(o)}><Pencil className="size-4" /></Button>}
                        <Button size="sm" variant="secondary" onClick={() => openReceipt.mutate(o)}>
                          <Printer className="size-4" />
                        </Button>
                        {o.status !== "refunded" && o.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Оформить возврат по чеку №${o.order_no}?`)) refund.mutate(o);
                            }}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "shifts" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Открыта</th>
                <th className="p-3">Закрыта</th>
                <th className="p-3">Кассир</th>
                <th className="p-3 text-right">Касса на начало</th>
                <th className="p-3 text-right">Касса на конец</th>
                <th className="p-3">Статус</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(shifts.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Смен пока нет
                  </td>
                </tr>
              )}
              {(shifts.data ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3">{formatDateTime(s.opened_at)}</td>
                  <td className="p-3">{s.closed_at ? formatDateTime(s.closed_at) : "—"}</td>
                  <td className="p-3">{employeeName(s.employee_id)}</td>
                  <td className="p-3 text-right">{formatKzt(s.cash_start)}</td>
                  <td className="p-3 text-right">{s.cash_end == null ? "—" : formatKzt(s.cash_end)}</td>
                  <td className="p-3">{s.status === "open" ? "Открыта" : "Закрыта"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setShiftReport(s.id)}>
                      {s.status === "open" ? "X-отчёт" : "Z-отчёт"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Чек</DialogTitle>
          </DialogHeader>
          {receipt && <Receipt data={receipt} settings={settings.data ?? null} />}
          <DialogFooter>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Печать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftReportDialog
        shiftId={shiftReport}
        onClose={() => setShiftReport(null)}
        employeeName={employeeName}
      />
      {paymentOrder && <PaymentCorrection key={paymentOrder.id} order={paymentOrder} onClose={() => setPaymentOrder(null)} />}
    </div>
  );
}

function ShiftReportDialog({
  shiftId,
  onClose,
  employeeName,
}: {
  shiftId: string | null;
  onClose: () => void;
  employeeName: (id: string | null) => string;
}) {
  const shifts = useQuery(shiftsQuery);
  const shift = (shifts.data ?? []).find((s) => s.id === shiftId) ?? null;

  const report = useQuery({
    queryKey: ["shift-report", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      if (!shiftId) return { orders: [] as Order[], ops: [] as { type: string; amount: number }[] };
      const rows: Order[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("orders").select("*").eq("shift_id", shiftId).order("id").range(offset, offset + 499);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if ((data ?? []).length < 500) break;
      }
      const ops: { type: string; amount: number }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("cash_operations").select("type, amount, id").eq("shift_id", shiftId).order("id").range(offset, offset + 499);
        if (error) throw new Error(error.message);
        ops.push(...(data ?? []));
        if ((data ?? []).length < 500) break;
      }
      return { orders: rows, ops };
    },
  });

  const dead = ["refunded", "cancelled"];
  const paid = (report.data?.orders ?? []).filter((o) => isSale(o.status));
  const refunded = (report.data?.orders ?? []).filter((o) => dead.includes(o.status));
  const { cash, card, revenue, cashIn, cashOut } = salesTotals(report.data?.orders ?? [], report.data?.ops ?? []);
  const expected = (shift?.cash_start ?? 0) + cash + cashIn - cashOut;
  const diff = shift?.cash_end == null ? null : shift.cash_end - expected;

  return (
    <Dialog open={!!shiftId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shift?.status === "open" ? "X-отчёт (без закрытия)" : "Z-отчёт смены"}</DialogTitle>
        </DialogHeader>
        {report.isError && <p role="alert" className="text-destructive">{report.error.message}</p>}
        {report.isPending && <p className="text-muted-foreground">Загрузка отчёта…</p>}
        {shift && report.isSuccess && (
          <div className="space-y-2 text-sm">
            <Row label="Кассир" value={employeeName(shift.employee_id)} />
            <Row label="Открыта" value={formatTime(shift.opened_at)} />
            <Row label="Закрыта" value={shift.closed_at ? formatTime(shift.closed_at) : "—"} />
            <hr className="border-border" />
            <Row label="Чеков" value={String(paid.length)} />
            <Row label="Возвратов" value={String(refunded.length)} />
            <Row label="Выручка" value={formatKzt(revenue)} />
            <Row label={PAYMENT_LABELS['cash'] ?? "Наличные"} value={formatKzt(cash)} />
            <Row label={PAYMENT_LABELS['card'] ?? "Карта"} value={formatKzt(card)} />
            <Row label="Внесения" value={formatKzt(cashIn)} />
            <Row label="Изъятия" value={formatKzt(cashOut)} />
            <hr className="border-border" />
            <Row label="Касса на начало" value={formatKzt(shift.cash_start)} />
            <Row label="Наличных должно быть" value={formatKzt(expected)} />
            <Row
              label="Фактически в кассе"
              value={shift.cash_end == null ? "—" : formatKzt(shift.cash_end)}
            />
            {diff != null && (
              <Row
                label={diff === 0 ? "Расхождений нет" : diff > 0 ? "Излишек" : "Недостача"}
                value={formatKzt(Math.abs(diff))}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
