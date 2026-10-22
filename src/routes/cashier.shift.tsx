import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  addCashOperation,
  closeShift,
  openShift,
  shiftReport,
} from "@/lib/cashier.functions";
import { formatDateTime, formatKzt } from "@/lib/pos";
import { useCashier } from "@/lib/use-cashier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumPad } from "@/components/pos/NumPad";


export const Route = createFileRoute("/cashier/shift")({
  head: () => ({
    meta: [
      { title: "Смена кассира: X- и Z-отчёт" },
      {
        name: "description",
        content:
          "Открытие и закрытие смены, наличные в кассе, внесение и изъятие денег, сверка выручки.",
      },
      { property: "og:title", content: "Смена кассира: X- и Z-отчёт" },
      { property: "og:description", content: "Итоги смены и сверка наличных в кассе." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShiftScreen,
});

function ShiftScreen() {
  const cashier = useCashier();
  const qc = useQueryClient();
  const report = useServerFn(shiftReport);
  const open = useServerFn(openShift);
  const close = useServerFn(closeShift);
  const cashOp = useServerFn(addCashOperation);

  const [cashStart, setCashStart] = useState(0);
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState("");
  const [opAmount, setOpAmount] = useState(0);
  const [opReason, setOpReason] = useState("");
  const [pad, setPad] = useState<"start" | "op" | "counted" | null>(null);

  const data = useQuery({
    queryKey: ["cashier", "shift-report"],
    queryFn: () => report(),
    enabled: !!cashier.data,
    refetchInterval: 30_000,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["cashier"] });
  }

  const openM = useMutation({
    mutationFn: () => open({ data: { cashStart } }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.message); return; }
      setCashStart(0);
      refresh();
      toast.success("Смена открыта");
    },
  });

  const closeM = useMutation({
    mutationFn: () =>
      close({ data: { countedCash: counted, note } }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.message); return; }
      setCounted(0);
      refresh();
      toast.success(
        res.counted === res.expectedCash
          ? "Смена закрыта, расхождений нет"
          : `Смена закрыта. Расхождение: ${formatKzt(res.counted - res.expectedCash)}`,
      );
    },
  });

  const opM = useMutation({
    mutationFn: (type: "in" | "out") =>
      cashOp({
        data: { type, amount: opAmount, reason: opReason },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.message); return; }
      setOpAmount(0);
      setOpReason("");
      refresh();
      toast.success("Операция записана");
    },
  });

  const shift = data.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cashier">
            <ArrowLeft className="size-4" /> Касса
          </Link>
        </Button>
        <h1 className="font-semibold">Смена</h1>
      </header>

      <div className="mx-auto grid max-w-3xl gap-4 p-4">
        {!shift ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Смена закрыта</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Откройте смену, указав наличные в кассе. Смена закрывается автоматически через 24
              часа.
            </p>
            <Label className="mt-4 block">Наличные в кассе на начало</Label>
            <Input
              className={`mt-2 ${pad === "start" ? "border-primary" : ""}`}
              inputMode="numeric"
              onFocus={() => setPad("start")}
              value={String(cashStart)}
              onChange={(e) => setCashStart(Number(e.target.value.replace(/\D/g, "")) || 0)}
              placeholder="0"
            />
            {pad === "start" && (
              <NumPad className="mt-3" value={cashStart} onChange={setCashStart} />
            )}
            <Button className="mt-3" size="lg" onClick={() => openM.mutate()}>
              <Wallet className="size-4" /> Открыть смену
            </Button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">X-отчёт (без закрытия)</h2>
              <p className="text-sm text-muted-foreground">
                Открыта с {formatDateTime(String(shift.shift.opened_at))}
              </p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <Stat label="Чеков" value={String(shift.totals.ordersCount)} />
                <Stat label="Отменено" value={String(shift.totals.cancelledCount)} />
                <Stat label="Выручка" value={formatKzt(shift.totals.salesTotal)} />
                <Stat label="Скидки" value={formatKzt(shift.totals.discountTotal)} />
                <Stat label="Наличными" value={formatKzt(shift.totals.cashTotal)} />
                <Stat label="Картой" value={formatKzt(shift.totals.cardTotal)} />
                <Stat label="Внесено" value={formatKzt(shift.totals.cashIn)} />
                <Stat label="Изъято" value={formatKzt(shift.totals.cashOut)} />
                <Stat label="Ожидается в кассе" value={formatKzt(shift.expectedCash)} />
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Внесение и изъятие наличных</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  inputMode="numeric"
                  className={pad === "op" ? "border-primary" : ""}
                  onFocus={() => setPad("op")}
                  value={String(opAmount)}
                  onChange={(e) => setOpAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  placeholder="Сумма"
                />
                <Input
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="Причина"
                />
              </div>
              {pad === "op" && (
                <NumPad className="mt-3" value={opAmount} onChange={setOpAmount} />
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => opM.mutate("in")}>
                  <ArrowDownCircle className="size-4" /> Внести
                </Button>
                <Button variant="secondary" onClick={() => opM.mutate("out")}>
                  <ArrowUpCircle className="size-4" /> Изъять
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Z-отчёт: закрытие смены</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Пересчитайте наличные. Смену нельзя закрыть, пока есть открытые заказы.
              </p>
              <Label className="mt-4 block">Наличные в кассе по факту</Label>
              <Input
                className={`mt-2 ${pad === "counted" ? "border-primary" : ""}`}
                inputMode="numeric"
                onFocus={() => setPad("counted")}
                value={String(counted)}
                onChange={(e) => setCounted(Number(e.target.value.replace(/\D/g, "")) || 0)}
                placeholder="0"
              />
              {pad === "counted" && (
                <NumPad className="mt-3" value={counted} onChange={setCounted} />
              )}
              <Label className="mt-3 block">Примечание</Label>
              <Input
                className="mt-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
              />
              <Button className="mt-3" size="lg" onClick={() => closeM.mutate()}>
                Закрыть смену
              </Button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-xl bg-muted px-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
