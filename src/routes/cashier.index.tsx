import { useEffect, useMemo, useRef, useState } from "react";
import { enqueueOrder, getQueue, isNetworkError, loadCatalog, markQueueError, removeQueued, saveCashier, saveCatalog, type QueuedOrder } from "@/lib/offline-queue";
import type { CreateOrderInputLike } from "@/lib/offline-types";
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
  Wifi,
  WifiOff,
  RefreshCw,
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
  formatKg,
  formatKzt,
  lineTotal,
  type CartLine,
  type CartModifier,
} from "@/lib/pos";
import { useCashier } from "@/lib/use-cashier";
import { useAutoPrint } from "@/lib/use-auto-print";
import { ReceiptPair } from "@/components/pos/CashierReceipts";
import { NumPad } from "@/components/pos/NumPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import chickenImage from "@/assets/product-chicken.jpg";
import donerImage from "@/assets/product-doner.jpg";
import friesImage from "@/assets/product-fries.jpg";
import drinkImage from "@/assets/product-drink.jpg";
import lavashImage from "@/assets/product-lavash.jpg";
import kryloImage from "@/assets/product-krylo.jpg";
import pitaImage from "@/assets/product-pita.jpg";
import shaurmaImage from "@/assets/product-shaurma.jpg";

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

function productImage(p: Row) {
  if (p["image_url"]) return s(p["image_url"]);
  const name = s(p["name"]).toLowerCase();
  if (/донер|шаурм/.test(name)) return shaurmaImage;
  if (/кур|гриль/.test(name)) return chickenImage;
if (/крыл|грy/.test(name)) return kryloImage;
if (/лаваш|хлеб|булочка/.test(name)) return lavashImage;
if (/пита|лепешка|печ/.test(name)) return pitaImage;
  if (/фри|карто/.test(name)) return friesImage;
  if (/кола|cola|пепси|pepsi|вода|сок|напит|чай|кофе|айран|фанта|fanta|sprite|спрайт/.test(name)) return drinkImage;
  return null;
}

function isWeight(p: Row) {
  const unit = s(p["unit"]).trim().toLowerCase();
  return unit === "кг" || unit === "kg";
}

function CashierPos() {
  const cashier = useCashier();
  const qc = useQueryClient();
  const load = useServerFn(getPosData);
  const logout = useServerFn(cashierLogout);
  const submit = useServerFn(createOrder);
  const lookup = useServerFn(findCustomer);

  const pos = useQuery({
    queryKey: ["cashier", "pos-data"],
    queryFn: async () => {
      try {
        const d = await load();
        saveCatalog(d);
        return d;
      } catch (e) {
        const cached = loadCatalog<Awaited<ReturnType<typeof load>>>();
        if (cached && isNetworkError(e)) return cached;
        throw e;
      }
    },
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
  const [padTarget, setPadTarget] = useState<"cash" | "card">("cash");
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [weightProduct, setWeightProduct] = useState<Row | null>(null);
  const [weightGrams, setWeightGrams] = useState(0);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<QueuedOrder[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const syncing = useRef(false);
  const payInFlight = useRef(false);
  const retrySync = useRef<() => void>(() => {});

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

  function addProduct(p: Row, picked: CartModifier[] = [], qty = 1) {
    const key = `${s(p["id"])}|${picked.map((m) => m.id).sort().join(",")}`;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [
        ...prev,
        {
          key,
          productId: s(p["id"]),
          name: s(p["name"]),
          price: n(p["price"]),
          qty,
          emoji: (p["emoji"] as string) ?? null,
          imageUrl: (p["image_url"] as string) ?? null,
          modifiers: picked,
          trackStock: !!p["track_stock"],
          byWeight: isWeight(p),
        },
      ];
    });
  }

  function onProductClick(p: Row) {
    if (p["in_stop_list"]) {
      toast.error("Товар в стоп-листе");
      return;
    }
    if (p["track_stock"] && n(p["stock"]) <= 0) {
      toast.error("Нет на складе");
      return;
    }
    if (isWeight(p)) {
      setWeightProduct(p);
      setWeightGrams(0);
      return;
    }
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

  function buildPayload(): CreateOrderInputLike {
    return {
      clientOrderId: crypto.randomUUID(),
      shiftId: s(shift?.["id"]), employeeId: s(cashier.data?.id),
      soldAt: new Date().toISOString(), expectedTotal: total,
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
      ...(customer && s(customer["name"]) ? { customerName: s(customer["name"]) } : {}),
      ...(phone ? { customerPhone: phone } : {}),
      ...(note ? { note } : {}),
      bonusUsed: bonus,
    };
  }

  function offlineReceipt(q: QueuedOrder): ReceiptPayload {
    const p = q.payload;
    const cashAmount = p.paymentMethod === "card" ? 0 : total - (p.paymentMethod === "mixed" ? p.cardAmount : 0);
    return {
      orderId: q.localId,
      offlineNo: q.localNo,
      orderNo: q.localNo,
      dailyNo: q.localNo,
      createdAt: q.createdAt,
      status: "open",
      orderType: orderType,
      cashierName: s(cashier.data?.name) || "Кассир",
      customerName: p.customerName ?? null,
      customerPhone: p.customerPhone ?? null,
      note: `ОФЛАЙН-заказ О-${q.localNo}. ${p.note ?? ""}`.trim(),
      items: lines.map((l) => ({
        name: l.name,
        qty: l.qty,
        price: l.price + l.modifiers.reduce((a, m) => a + m.price, 0),
        total: lineTotal(l),
        modifiers: l.modifiers.map((m) => ({ name: m.name, price: m.price })),
      })),
      subtotal,
      discount: discount + bonus,
      total,
      paymentMethod: method,
      cashAmount,
      cardAmount: p.cardAmount,
      cashReceived: p.cashReceived,
      changeGiven: change,
      bonusEarned: 0,
      bonusUsed: bonus,
      fiscalNumber: null,
      fiscalCheckUrl: null,
      shop: {
        name: s(settings?.["shop_name"]) || "Гриль & Донер",
        address: s(settings?.["address"]),
        phone: s(settings?.["phone"]),
        footer: s(settings?.["receipt_footer"]),
        vatPercent: n(settings?.["vat_percent"]),
      },
    };
  }

  function saveOffline(payload: CreateOrderInputLike) {
    const q = enqueueOrder(payload);
    setReceipt(offlineReceipt(q));
    setPayOpen(false);
    resetCart();
    toast.warning(`Нет связи — заказ О-${q.localNo} сохранён и отправится автоматически`);
  }

  const payM = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!shift || Date.now() - Date.parse(s(shift["opened_at"])) >= 86_400_000)
        throw new Error("Смена истекла — продажи недоступны");
      if (!online && bonus > 0) throw new Error("Без связи списание бонусов недоступно");
      payInFlight.current = true;
      try {
        const q = enqueueOrder(payload);
        if (!navigator.onLine) return { offline: true as const, payload: q.payload };
        const res = await submit({ data: q.payload });
        removeQueued(q.localId);
        return { offline: false as const, res };
      } catch (e) {
        if (isNetworkError(e)) { setOnline(false); return { offline: true as const, payload }; }
        if (getQueue().some((q) => q.localId === payload.clientOrderId))
          markQueueError(payload.clientOrderId ?? "", e instanceof Error ? e.message : String(e));
        throw e;
      } finally { payInFlight.current = false; }
    },
    onSuccess: (r) => {
      if (r.offline) { saveOffline(r.payload); return; }
      const res = r.res;
      if (!res.ok) { toast.error(res.message); return; }
      setReceipt(res.receipt);
      setPayOpen(false);
      resetCart();
      qc.invalidateQueries({ queryKey: ["cashier"] });
      toast.success(`Заказ №${res.receipt.dailyNo} принят`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    let disposed = false;
    const refresh = () => { if (!disposed) setQueued(getQueue()); };
    async function sync() {
      refresh();
      if (syncing.current || payInFlight.current || !navigator.onLine) return;
      syncing.current = true;
      if (!disposed) setSyncBusy(true);
      let sent = 0;
      try {
        for (const q of getQueue()) {
          try {
            if (!q.payload.clientOrderId || !q.payload.shiftId || !q.payload.employeeId) {
              markQueueError(q.localId, "Старый офлайн-заказ: требуется разбор администратором"); continue;
            }
            const res = await submit({ data: q.payload });
            if (!disposed) setOnline(true);
            if (res.ok) { sent++; removeQueued(q.localId); }
            else markQueueError(q.localId, res.message);
          } catch (e) {
            if (isNetworkError(e)) { if (!disposed) setOnline(false); break; }
            markQueueError(q.localId, e instanceof Error ? e.message : String(e)); break;
          }
        }
      } finally {
        syncing.current = false;
        if (!disposed) setSyncBusy(false);
        refresh();
      }
      if (sent) { toast.success(`Отправлено офлайн-заказов: ${sent}`); qc.invalidateQueries({ queryKey: ["cashier"] }); }
    }
    retrySync.current = () => { void sync(); void pos.refetch().then((r) => { if (!disposed && !r.isError && navigator.onLine) setOnline(true); }); };
    const connectionChanged = () => { setOnline(navigator.onLine); if (navigator.onLine) retrySync.current(); };
    setOnline(navigator.onLine); refresh(); void sync();
    const timer = setInterval(() => void sync(), 20_000);
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    window.addEventListener("pos-queue-changed", refresh);
    return () => {
      disposed = true; clearInterval(timer);
      window.removeEventListener("online", connectionChanged);
      window.removeEventListener("offline", connectionChanged);
      window.removeEventListener("pos-queue-changed", refresh);
    };
  }, [submit, qc]);

  const queueStatus = <>
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm print:hidden">
      {online ? <Wifi className="size-4 text-accent" /> : <WifiOff className="size-4 text-primary" />}
      <span>{online ? "Есть связь" : "Нет связи · офлайн"}</span>
      {queued.length > 0 && <Button variant="link" size="sm" className="h-auto whitespace-normal p-0" onClick={() => setQueueOpen(true)}>Ожидают отправки: {queued.length}{queued.some((q) => q.error) ? " · требуется проверка" : ""}</Button>}
      <Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Повторить отправку" title="Повторить отправку" disabled={syncBusy || !online} onClick={() => retrySync.current()}><RefreshCw className={`size-4 ${syncBusy ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button>
    </div>
    <Dialog open={queueOpen} onOpenChange={setQueueOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Офлайн-заказы · {queued.length}</DialogTitle></DialogHeader>
      {queued.length === 0 ? <p className="text-muted-foreground">Все заказы отправлены</p> : queued.map((q) => <div key={q.localId} className="border-b border-border py-3"><div className="flex justify-between gap-2 font-semibold"><span>О-{q.localNo}</span><span>{formatKzt(q.payload.expectedTotal ?? 0)}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleString("ru-RU")}</p><p className={`mt-2 text-sm ${q.error ? "text-destructive" : "text-muted-foreground"}`}>{q.error || "Ожидает отправки"}</p></div>)}
      <Button disabled={syncBusy || !online || !queued.length} onClick={() => retrySync.current()}><RefreshCw className="size-4" />{syncBusy ? "Отправка…" : "Отправить сейчас"}</Button>
    </Dialog>
  </>;

  const printCashier = settings?.["print_cashier_receipt"] !== false;
  const printCustomer = settings?.["print_customer_receipt"] !== false;
  const autoPrint = settings?.["auto_print"] !== false && (printCashier || printCustomer);
  const printCopies = Math.min(3, Math.max(1, Number(settings?.["print_copies"] ?? 1) || 1));

  useAutoPrint(!!receipt, !!receipt && autoPrint, printCopies);

  if (receipt) {
    return (
      <main className="min-h-screen bg-muted p-4">
        {queueStatus}
        <div id="receipt-print">
          <ReceiptPair r={receipt} cashier={printCashier} customer={printCustomer} />
        </div>
        <div className="mx-auto mt-4 max-w-sm print:hidden">
          {settings?.["printer_name"] ? (
            <p className="mb-2 text-center text-xs text-muted-foreground">
              Принтер: {String(settings["printer_name"])}
            </p>
          ) : null}
          <div className="flex gap-2">
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="size-4" /> Печать
          </Button>
            <Button className="flex-1" variant="secondary" onClick={() => setReceipt(null)}>
              Новый заказ
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold">Касса</h1>
          <span className="truncate text-sm text-muted-foreground">{cashier.data?.name}</span>
        </div>
        <div className="flex shrink-0 gap-1 sm:gap-2">
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
            aria-label="Выйти из кассы"
            title="Выйти из кассы"
            onClick={async () => {
              await logout();
              saveCashier(null);
              qc.clear();
              window.location.href = "/cashier/login";
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      {queueStatus}

      {!shift && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-destructive" />
          Смена закрыта — продажи недоступны.
          <Button asChild size="sm">
            <Link to="/cashier/shift">Открыть смену</Link>
          </Button>
        </div>
      )}
      {(data?.lowStock?.length ?? 0) > 0 && (
        <div className="shrink-0 px-4 py-2 text-xs text-muted-foreground lg:max-h-16 lg:overflow-y-auto">
          Мало на складе: {data?.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
        </div>
      )}

      <div className="grid min-h-0 min-w-0 gap-4 p-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:px-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Блюда" className="flex min-h-0 min-w-0 flex-col lg:overflow-hidden">
          <div className="relative shrink-0">
            <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск блюда"
              aria-label="Поиск блюда"
              className="h-11 pl-9"
            />
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap gap-2">
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

          <div aria-label="Список блюд" className="mt-4 grid min-h-0 auto-rows-max grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:pb-2">
            {pos.isPending && <p className="col-span-full py-8 text-center text-muted-foreground">Загрузка блюд…</p>}
            {pos.isError && <div className="col-span-full py-8 text-center"><p className="mb-3 text-destructive">Не удалось загрузить блюда</p><Button variant="secondary" onClick={() => pos.refetch()}>Повторить</Button></div>}
            {!pos.isPending && !pos.isError && visible.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">Блюда не найдены</p>}
            {visible.map((p) => {
              const out = !!p["in_stop_list"] || (!!p["track_stock"] && n(p["stock"]) <= 0);
              const image = productImage(p);
              return (
                <Button
                  key={s(p["id"])}
                  onClick={() => onProductClick(p)}
                  disabled={!shift || out}
                  variant="ghost"
                  className={`tile-press relative aspect-square h-auto min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-lg border border-border bg-card p-0 text-left text-card-foreground hover:bg-card hover:text-card-foreground ${
                    out ? "opacity-40" : "hover:border-primary"
                  }`}
                >
                  {image ? <img src={image} alt="" loading="lazy" className="h-[46%] w-full shrink-0 object-cover" /> : <div className="flex h-[46%] shrink-0 items-center justify-center bg-muted text-4xl">{s(p["emoji"]) || "🍽️"}</div>}
                  <div className="flex min-h-0 flex-1 flex-col justify-between p-3">
                    <div className="line-clamp-2 break-words text-sm leading-tight font-semibold">{s(p["name"])}</div>
                    <div className="mt-1 text-sm font-bold text-primary tnum">
                      {formatKzt(n(p["price"]))}
                      {isWeight(p) ? <span className="text-xs font-normal"> /кг</span> : null}
                    </div>
                  </div>
                  {out ? <span className="absolute top-2 left-2 rounded bg-background px-2 py-1 text-xs text-destructive">Нет в наличии</span> : null}
                </Button>
              );
            })}
          </div>
        </section>

        <aside aria-label="Текущий заказ" className="flex min-h-0 min-w-0 flex-col border border-border bg-card lg:overflow-hidden">
          <h2 className="shrink-0 border-b border-border px-4 py-3 text-lg font-semibold">Чек <span className="ml-2 text-sm font-normal text-muted-foreground">{lines.length} поз.</span></h2>
          <div className="min-h-0 flex-1 p-4 lg:overflow-y-auto lg:overscroll-contain">
          <div className="grid gap-2">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">Корзина пуста</p>}
            {lines.map((l) => (
              <div key={l.key} className="rounded-lg bg-muted p-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0 break-words">
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
                    aria-label={`Уменьшить количество: ${l.name}`}
                    onClick={() =>
                      setLines((prev) =>
                        prev
                          .map((x) =>
                            x.key === l.key ? { ...x, qty: x.qty - (x.byWeight ? 0.05 : 1) } : x,
                          )
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-14 text-center text-sm tnum">{l.byWeight ? formatKg(l.qty) : l.qty}</span>
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={`Увеличить количество: ${l.name}`}
                    onClick={() =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.key === l.key ? { ...x, qty: x.qty + (x.byWeight ? 0.05 : 1) } : x,
                        ),
                      )
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={`Удалить из чека: ${l.name}`}
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7…"
              />
              <Button variant="secondary" disabled={!online} onClick={() => findM.mutate()}>
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
                    disabled={!online}
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

          </div>
          <div className="shrink-0 border-t border-border bg-card p-4">
          <div className="space-y-1 text-sm tnum">
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
              setPadTarget("cash");
              setPayOpen(true);
            }}
          >
            К оплате
          </Button>
          </div>
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

      <Dialog open={!!weightProduct} onOpenChange={(o) => !o && setWeightProduct(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{s(weightProduct?.["name"])}: вес</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Цена за кг: {formatKzt(n(weightProduct?.["price"]))}
          </p>
          <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-3xl font-bold tnum">{formatKg(weightGrams / 1000)}</div>
            <div className="mt-1 text-lg font-semibold text-primary tnum">
              {formatKzt(Math.round((n(weightProduct?.["price"]) * weightGrams) / 1000))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[100, 250, 500, 1000].map((g) => (
              <Button key={g} size="sm" variant="secondary" onClick={() => setWeightGrams(g)}>
                {g >= 1000 ? "1 кг" : `${g} г`}
              </Button>
            ))}
          </div>
          <NumPad value={weightGrams} onChange={setWeightGrams} />
          <Button
            size="lg"
            disabled={weightGrams <= 0}
            onClick={() => {
              if (!weightProduct) return;
              addProduct(weightProduct, [], Math.round(weightGrams) / 1000);
              setWeightProduct(null);
              setWeightGrams(0);
            }}
          >
            Добавить в чек
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
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
                  setPadTarget(v === "mixed" ? "card" : "cash");
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
                className={`mt-2 ${padTarget === "card" ? "border-primary" : ""}`}
                inputMode="numeric"
                onFocus={() => setPadTarget("card")}
                value={String(cardAmount)}
                onChange={(e) => setCardAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
            </div>
          )}

          {method !== "card" && (
            <div>
              <Label>Получено наличными</Label>
              <Input
                className={`mt-2 text-lg ${padTarget === "cash" ? "border-primary" : ""}`}
                inputMode="numeric"
                onFocus={() => setPadTarget("cash")}
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

          {method !== "card" && (
            <NumPad
              value={padTarget === "card" ? cardAmount : cashReceived}
              onChange={(v) => (padTarget === "card" ? setCardAmount : setCashReceived)(v)}
            />
          )}

          <Button size="lg" disabled={payM.isPending || syncBusy || (method !== "card" && cashReceived < total - (method === "mixed" ? cardAmount : 0)) || cardAmount > total} onClick={() => payM.mutate()}>
            Провести оплату
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
