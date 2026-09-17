import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ClipboardList,
  LogOut,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  cashierLogout,
  createOrder,
  findCustomer,
  getPosData,
  type OrderType,
  type PaymentMethod,
  type ReceiptPayload,
} from "@/lib/cashier.functions";
import {
  CASH_BILLS,
  cartSubtotal,
  formatKzt,
  lineTotal,
  type CartLine,
  type CartModifier,
} from "@/lib/pos";
import { useCashier } from "@/lib/use-cashier";
import { useAutoPrint } from "@/lib/use-auto-print";
import { ReceiptPair } from "@/components/pos/CashierReceipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/cashier/")({
  head: () => ({
    meta: [
      { title: "Касса: продажи куры гриль и донеров" },
      {
        name: "description",
        content:
          "Экран продавца: выбор блюд и добавок, скидки, оплата наличными или картой, расчёт сдачи и печать двух чеков.",
      },
      { property: "og:title", content: "Касса: продажи куры гриль и донеров" },
      {
        property: "og:description",
        content: "Быстрая продажа, сдача, бонусы клиента и печать чеков кассира и покупателя.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CashierPos,
});

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => Number(v ?? 0);

function CashierPos() {
  const cashier = useCashier();
  const qc = useQueryClient();
  const load = useServerFn(getPosData);
  const logout = useServerFn(cashierLogout);
  const submit = useServerFn(createOrder);
  const lookup = useServerFn(findCustomer);

  const pos = useQuery({
    queryKey: ["cashier", "pos-data"],
    queryFn: () => load(),
    enabled: !!cashier.data,
    refetchInterval: 60_000,
  });

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [modProduct, setModProduct] = useState<Row | null>(null);
  const [modPicked, setModPicked] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Row | null>(null);
  const [bonusUsed, setBonusUsed] = useState(0);
  const [note, setNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const data = pos.data;
  const products = (data?.products ?? []) as Row[];
  const modifiers = (data?.modifiers ?? []) as Row[];
  const settings = (data?.settings ?? null) as Row | null;
  const shift = data?.shift as Row | null | undefined;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && s(p["category_id"]) !== category) return false;
      if (q && !s(p["name"]).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, category, search]);

  const subtotal = cartSubtotal(lines);
  const discount = Math.min(subtotal, Math.round((subtotal * discountPercent) / 100) + discountAmount);
  const maxBonus = customer ? Math.min(n(customer["bonus"]), subtotal - discount) : 0;
  const bonus = Math.min(bonusUsed, maxBonus);
  const total = Math.max(0, subtotal - discount - bonus);
  const change = Math.max(0, cashReceived - (method === "mixed" ? total - cardAmount : total));

  function addProduct(p: Row, picked: CartModifier[] = []) {
    const key = `${s(p["id"])}|${picked.map((m) => m.id).sort().join(",")}`;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...prev,
        {
          key,
          productId: s(p["id"]),
          name: s(p["name"]),
          price: n(p["price"]),
          qty: 1,
          emoji: (p["emoji"] as string) ?? null,
          imageUrl: (p["image_url"] as string) ?? null,
          modifiers: picked,
          trackStock: !!p["track_stock"],
        },
      ];
    });
  }

  function onProductClick(p: Row) {
    if (p["in_stop_list"]) return toast.error("Товар в стоп-листе");
    if (p["track_stock"] && n(p["stock"]) <= 0) return toast.error("Нет на складе");
    const allowed = modifiers.filter((m) => !m["category_id"] || m["category_id"] === p["category_id"]);
    if (allowed.length > 0) {
      setModProduct(p);
      setModPicked([]);
      return;
    }
    addProduct(p);
  }

  function resetCart() {
    setLines([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setNote("");
    setPhone("");
    setCustomer(null);
    setBonusUsed(0);
    setCashReceived(0);
    setCardAmount(0);
    setMethod("cash");
  }

  const findM = useMutation({
    mutationFn: () => lookup({ data: { phone } }),
    onSuccess: (res) => {
      setCustomer((res ?? null) as Row | null);
      if (!res) toast.info("Клиент не найден — будет создан после оплаты");
    },
  });

  const payM = useMutation({
    mutationFn: () =>
      submit({
        data: {
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            modifierIds: l.modifiers.map((m) => m.id),
          })),
          discountPercent,
          discountAmount,
          paymentMethod: method,
          cashReceived: method === "card" ? 0 : cashReceived,
          cardAmount: method === "mixed" ? cardAmount : method === "card" ? total : 0,
          orderType,
          customerName: customer ? s(customer["name"]) : undefined,
          customerPhone: phone || undefined,
          note: note || undefined,
          bonusUsed: bonus,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      setReceipt(res.receipt);
      setPayOpen(false);
      resetCart();
      qc.invalidateQueries({ queryKey: ["cashier"] });
      toast.success(`Заказ №${res.receipt.dailyNo} принят`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useAutoPrint(!!receipt, !!receipt && settings?.["print_customer_receipt"] !== false, 1);

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
            Новый заказ
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="font-bold">Касса</h1>
        <span className="text-sm text-muted-foreground">{cashier.data?.name}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/cashier/orders">
              <ClipboardList className="size-4" /> Заказы
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/cashier/shift">
              <Wallet className="size-4" /> Смена
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await logout();
              qc.clear();
              window.location.href = "/cashier/login";
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {!shift && (
        <div className="flex flex-wrap items-center gap-3 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-destructive" />
          Смена закрыта — продажи недоступны.
          <Button asChild size="sm">
            <Link to="/cashier/shift">Открыть смену</Link>
          </Button>
        </div>
      )}
      {(data?.lowStock?.length ?? 0) > 0 && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Мало на складе: {data?.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="relative">
            <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск блюда"
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category === null ? "default" : "secondary"}
              onClick={() => setCategory(null)}
            >
              Всё
            </Button>
            {(data?.categories ?? []).map((c: Row) => (
              <Button
                key={s(c["id"])}
                size="sm"
                variant={category === s(c["id"]) ? "default" : "secondary"}
                onClick={() => setCategory(s(c["id"]))}
              >
                {s(c["name"])}
              </Button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => {
              const out = !!p["in_stop_list"] || (!!p["track_stock"] && n(p["stock"]) <= 0);
              return (
                <button
                  key={s(p["id"])}
                  onClick={() => onProductClick(p)}
                  disabled={!shift}
                  className={`tile-press rounded-2xl border border-border bg-card p-3 text-left ${
                    out ? "opacity-40" : "hover:border-primary"
                  }`}
                >
                  <div className="text-2xl">{s(p["emoji"]) || "🍽️"}</div>
                  <div className="mt-2 text-sm leading-tight font-semibold">{s(p["name"])}</div>
                  <div className="mt-1 text-sm text-primary">{formatKzt(n(p["price"]))}</div>
                  {out ? <div className="text-xs text-destructive">нет в наличии</div> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Чек</h2>
          <div className="mt-3 grid gap-2">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">Корзина пуста</p>}
            {lines.map((l) => (
              <div key={l.key} className="rounded-xl bg-muted p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.name}</div>
                    {l.modifiers.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        + {l.modifiers.map((m) => m.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold">{formatKzt(lineTotal(l))}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                      setLines((prev) =>
                        prev
                          .map((x) => (x.key === l.key ? { ...x, qty: x.qty - 1 } : x))
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center">{l.qty}</span>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                      setLines((prev) =>
                        prev.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)),
                      )
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["takeaway", "С собой"],
                ["dinein", "В зале"],
                ["delivery", "Доставка"],
              ] as const
            ).map(([v, label]) => (
              <Button
                key={v}
                size="sm"
                variant={orderType === v ? "default" : "secondary"}
                onClick={() => setOrderType(v)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(data?.discounts ?? []).map((d: Row) => {
              const percent = d["kind"] === "percent";
              const activeD = percent
                ? discountPercent === n(d["value"])
                : discountAmount === n(d["value"]);
              return (
                <Button
                  key={s(d["id"])}
                  size="sm"
                  variant={activeD ? "default" : "outline"}
                  onClick={() => {
                    if (percent) {
                      setDiscountAmount(0);
                      setDiscountPercent(activeD ? 0 : n(d["value"]));
                    } else {
                      setDiscountPercent(0);
                      setDiscountAmount(activeD ? 0 : n(d["value"]));
                    }
                  }}
                >
                  {s(d["name"])}
                </Button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2">
            <Label>Телефон клиента (бонусы)</Label>
            <div className="flex gap-2">
              <Input
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7…"
              />
              <Button variant="secondary" onClick={() => findM.mutate()}>
                Найти
              </Button>
            </div>
            {customer && (
              <div className="text-xs text-muted-foreground">
                {s(customer["name"]) || "Клиент"} · бонусов: {n(customer["bonus"])}
                {maxBonus > 0 && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 pl-2"
                    onClick={() => setBonusUsed(bonus > 0 ? 0 : maxBonus)}
                  >
                    {bonus > 0 ? "не списывать" : `списать ${maxBonus}`}
                  </Button>
                )}
              </div>
            )}
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Примечание к заказу"
            />
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма</span>
              <span>{formatKzt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Скидка</span>
                <span>-{formatKzt(discount)}</span>
              </div>
            )}
            {bonus > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Бонусы</span>
                <span>-{formatKzt(bonus)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>ИТОГО</span>
              <span>{formatKzt(total)}</span>
            </div>
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!shift || lines.length === 0}
            onClick={() => {
              setCashReceived(total);
              setCardAmount(0);
              setPayOpen(true);
            }}
          >
            К оплате
          </Button>
        </aside>
      </div>

      <Dialog open={!!modProduct} onOpenChange={(o) => !o && setModProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s(modProduct?.["name"])}: добавки</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {modifiers
              .filter(
                (m) => !m["category_id"] || m["category_id"] === modProduct?.["category_id"],
              )
              .map((m) => {
                const id = s(m["id"]);
                const picked = modPicked.includes(id);
                return (
                  <Button
                    key={id}
                    variant={picked ? "default" : "secondary"}
                    onClick={() =>
                      setModPicked((prev) =>
                        picked ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                  >
                    {s(m["name"])} · +{formatKzt(n(m["price"]))}
                  </Button>
                );
              })}
          </div>
          <Button
            size="lg"
            onClick={() => {
              if (!modProduct) return;
              const picked: CartModifier[] = modifiers
                .filter((m) => modPicked.includes(s(m["id"])))
                .map((m) => ({ id: s(m["id"]), name: s(m["name"]), price: n(m["price"]) }));
              addProduct(modProduct, picked);
              setModProduct(null);
            }}
          >
            Добавить в чек
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оплата {formatKzt(total)}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            {(
              [
                ["cash", "Наличные"],
                ["card", "Карта"],
                ["mixed", "Смешанная"],
              ] as const
            ).map(([v, label]) => (
              <Button
                key={v}
                className="flex-1"
                variant={method === v ? "default" : "secondary"}
                onClick={() => {
                  setMethod(v);
                  setCashReceived(v === "card" ? 0 : total);
                  setCardAmount(v === "mixed" ? 0 : v === "card" ? total : 0);
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {method === "mixed" && (
            <div>
              <Label>Сумма картой</Label>
              <Input
                className="mt-2"
                inputMode="numeric"
                value={String(cardAmount)}
                onChange={(e) => setCardAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
            </div>
          )}

          {method !== "card" && (
            <div>
              <Label>Получено наличными</Label>
              <Input
                className="mt-2 text-lg"
                inputMode="numeric"
                value={String(cashReceived)}
                onChange={(e) => setCashReceived(Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {CASH_BILLS.map((b) => (
                  <Button
                    key={b}
                    size="sm"
                    variant="secondary"
                    onClick={() => setCashReceived((v) => v + b)}
                  >
                    +{b}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setCashReceived(0)}>
                  Сброс
                </Button>
              </div>
              <p className="mt-3 text-lg font-bold">Сдача: {formatKzt(change)}</p>
            </div>
          )}

          <Button size="lg" disabled={payM.isPending} onClick={() => payM.mutate()}>
            Провести оплату
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
