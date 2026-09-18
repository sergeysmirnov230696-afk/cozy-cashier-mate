import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Printer, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCashierOrders,
  reprintOrder,
  setOrderStatus,
  type OrderStatus,
  type ReceiptPayload,
} from "@/lib/cashier.functions";
import { formatKzt, formatTime } from "@/lib/pos";
import { useCashier } from "@/lib/use-cashier";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, ReceiptPair } from "@/components/pos/CashierReceipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/cashier/orders")({
  head: () => ({
    meta: [
      { title: "Заказы кассира: открытые, выполненные, отменённые" },
      {
        name: "description",
        content:
          "Список заказов за день по статусам: отметить выполнение, отменить с возвратом остатков, распечатать чек заново.",
      },
      { property: "og:title", content: "Заказы кассира по статусам" },
      {
        property: "og:description",
        content: "Открытые, выполненные и отменённые заказы за сегодня.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersScreen,
});

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => Number(v ?? 0);

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "open", label: "Открытые" },
  { value: "completed", label: "Выполненные" },
  { value: "cancelled", label: "Отменённые" },
  { value: "all", label: "Все" },
];

function OrdersScreen() {
  const cashier = useCashier();
  const qc = useQueryClient();
  const list = useServerFn(listCashierOrders);
  const changeStatus = useServerFn(setOrderStatus);
  const reprint = useServerFn(reprintOrder);

  const [filter, setFilter] = useState<OrderStatus | "all">("open");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const orders = useQuery({
    queryKey: ["cashier", "orders", filter],
    queryFn: () => list({ data: { status: filter } }),
    enabled: !!cashier.data,
    refetchInterval: 15_000,
  });

  const statusM = useMutation({
    mutationFn: (input: { orderId: string; status: OrderStatus; reason?: string }) =>
      changeStatus({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.message); return; }
      setCancelId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["cashier"] });
      toast.success("Статус обновлён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printM = useMutation({
    mutationFn: (orderId: string) => reprint({ data: { orderId } }),
    onSuccess: (res) => {
      if (!res) { toast.error("Заказ не найден"); return; }
      setReceipt(res);
      setTimeout(() => window.print(), 400);
    },
  });

  if (receipt) {
    return (
      <main className="min-h-screen bg-muted p-4">
        <div id="receipt-print">
          <ReceiptPair r={receipt} />
        </div>
        <div className="mx-auto mt-4 flex max-w-sm gap-2 print:hidden">
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="size-4" /> Печать
          </Button>
          <Button className="flex-1" variant="secondary" onClick={() => setReceipt(null)}>
            Назад
          </Button>
        </div>
      </main>
    );
  }

  const rows = (orders.data ?? []) as Row[];

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cashier">
            <ArrowLeft className="size-4" /> Касса
          </Link>
        </Button>
        <h1 className="font-semibold">Заказы за сегодня</h1>
      </header>

      <div className="mx-auto max-w-4xl p-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "secondary"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Заказов нет</p>
          )}
          {rows.map((o) => {
            const status = s(o["status"]);
            const items = (o["items"] ?? []) as Row[];
            return (
              <article key={s(o["id"])} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-bold">№ {n(o["daily_no"])}</span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    {ORDER_STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ORDER_TYPE_LABELS[s(o["order_type"])] ?? ""} · {formatTime(s(o["created_at"]))}
                  </span>
                  <span className="ml-auto font-semibold">{formatKzt(n(o["total"]))}</span>
                </div>
                <ul className="mt-2 text-sm text-muted-foreground">
                  {items.map((i) => (
                    <li key={s(i["id"])}>
                      {s(i["name"])} × {n(i["qty"])}
                    </li>
                  ))}
                </ul>
                {o["cancel_reason"] ? (
                  <p className="mt-2 text-xs text-destructive">
                    Причина отмены: {s(o["cancel_reason"])}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {status === "open" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          statusM.mutate({ orderId: s(o["id"]), status: "completed" })
                        }
                      >
                        <Check className="size-4" /> Выполнен
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setCancelId(s(o["id"]));
                          setReason("");
                        }}
                      >
                        <X className="size-4" /> Отменить
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => printM.mutate(s(o["id"]))}
                  >
                    <Printer className="size-4" /> Чек
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отмена заказа</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Остатки и бонусы вернутся автоматически. Укажите причину.
          </p>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина отмены"
          />
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || statusM.isPending}
            onClick={() =>
              cancelId &&
              statusM.mutate({ orderId: cancelId, status: "cancelled", reason: reason.trim() })
            }
          >
            Отменить заказ
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
