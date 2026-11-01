import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  employeesQuery,
  orderItemsQuery,
  ordersQuery,
} from "@/lib/pos-queries";
import { formatKzt, PAYMENT_LABELS } from "@/lib/pos";
import { ReportPeriod, useReportPeriod } from "@/components/pos/ReportPeriod";
import { isSale } from "@/lib/sales";
import { Banknote, CreditCard, ReceiptText, TrendingUp, Undo2, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Отчёты по продажам точки" },
      {
        name: "description",
        content: "Выручка, средний чек, топ товаров, продажи по кассирам и способам оплаты.",
      },
      { property: "og:title", content: "Отчёты по продажам точки" },
      { property: "og:description", content: "Аналитика продаж в тенге за день, неделю и месяц." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const selection = useReportPeriod();
  const { from, to } = selection.range;
  const orders = useQuery(ordersQuery(from, to));
  const items = useQuery(orderItemsQuery(from, to));
  const employees = useQuery(employeesQuery);

  const paid = (orders.data ?? []).filter((o) => isSale(o.status));
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;
  const cash = paid.reduce((s, o) => s + o.cash_amount, 0);
  const card = paid.reduce((s, o) => s + o.card_amount, 0);
  const refunds = (orders.data ?? []).filter((o) => o.status === "refunded" || o.status === "cancelled");

  const top = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; sum: number }>();
    for (const i of items.data ?? []) {
      if (!isSale(i.orders?.status ?? "")) continue;
      const cur = map.get(i.name) ?? { name: i.name, qty: 0, sum: 0 };
      cur.qty += Number(i.qty);
      cur.sum += i.total;
      map.set(i.name, cur);
    }
    return [...map.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);
  }, [items.data]);

  const byCashier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; sum: number }>();
    for (const o of paid) {
      const name =
        (employees.data ?? []).find((e) => e.id === o.employee_id)?.name ?? "Без кассира";
      const cur = map.get(name) ?? { name, count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += o.total;
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.sum - a.sum);
  }, [paid, employees.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Отчёты</h1>
      </div>
      <ReportPeriod selection={selection} />

      {(orders.isError || items.isError || employees.isError) && <p role="alert" className="text-destructive">Не удалось загрузить отчёт. {orders.error?.message ?? items.error?.message ?? employees.error?.message}</p>}
      {(orders.isPending || items.isPending) && <p className="text-muted-foreground">Загрузка отчёта…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Выручка" value={formatKzt(revenue)} icon={TrendingUp} prominent />
        <Stat label="Чеков" value={String(paid.length)} icon={ReceiptText} />
        <Stat label="Средний чек" value={formatKzt(avg)} icon={Wallet} />
        <Stat label={PAYMENT_LABELS['cash'] ?? "Наличные"} value={formatKzt(cash)} icon={Banknote} />
        <Stat label={PAYMENT_LABELS['card'] ?? "Карта"} value={formatKzt(card)} icon={CreditCard} />
        <Stat label="Возвраты и отмены" value={String(refunds.length)} icon={Undo2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Топ товаров">
          {top.length === 0 && <Empty />}
          {top.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm">
              <span className="min-w-0 break-words">
                {t.name} <span className="text-muted-foreground">× {t.qty}</span>
              </span>
              <span className="shrink-0 font-semibold tnum">{formatKzt(t.sum)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="По кассирам">
          {byCashier.length === 0 && <Empty />}
          {byCashier.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm">
              <span className="min-w-0 break-words">
                {c.name} <span className="text-muted-foreground">· {c.count} чек(ов)</span>
              </span>
              <span className="shrink-0 font-semibold tnum">{formatKzt(c.sum)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, prominent }: { label: string; value: string; icon: LucideIcon; prominent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-lg border bg-card p-5 ${prominent ? "border-primary/50" : "border-border"}`}>
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{label}</p><Icon className={`size-5 shrink-0 ${prominent ? "text-primary" : "text-accent"}`} /></div>
      <p className={`mt-4 break-words text-2xl font-extrabold tnum ${prominent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t border-border pt-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Нет данных за период</p>;
}
