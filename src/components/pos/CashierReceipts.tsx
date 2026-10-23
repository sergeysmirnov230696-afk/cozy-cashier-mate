import QRCode from "react-qr-code";
import { formatDateTime, formatKzt, PAYMENT_LABELS } from "@/lib/pos";
import type { ReceiptPayload } from "@/lib/cashier.functions";

export const ORDER_TYPE_LABELS: Record<string, string> = {
  takeaway: "С собой",
  dinein: "В зале",
  delivery: "Доставка",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Открыт",
  completed: "Выполнен",
  cancelled: "Отменён",
};

function qtyLabel(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  return `${qty.toFixed(3).replace(".", ",").replace(/0+$/, "").replace(/,$/, "")} кг`;
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-black/40" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const sheet =
  "receipt-print mx-auto w-full max-w-[320px] rounded-xl bg-white p-4 font-mono text-[12px] leading-5 text-black";

/** Чек кассира: полная информация для выполнения заказа и отчётности. */
export function CashierReceipt({ r }: { r: ReceiptPayload }) {
  return (
    <div className={sheet}>
      <div className="text-center text-sm font-bold uppercase">Чек кассира</div>
      <div className="text-center text-3xl font-bold">№ {r.dailyNo}</div>
      <div className="text-center">{ORDER_TYPE_LABELS[r.orderType] ?? r.orderType}</div>
      <Divider />
      <div className="flex justify-between">
        <span>Смена-чек {r.orderNo}</span>
        <span>{formatDateTime(r.createdAt)}</span>
      </div>
      <div>Кассир: {r.cashierName}</div>
      {r.customerName ? <div>Клиент: {r.customerName}</div> : null}
      {r.customerPhone ? <div>Телефон: {r.customerPhone}</div> : null}
      {r.status === "cancelled" ? <div className="font-bold">*** ОТМЕНЁН ***</div> : null}
      <Divider />
      {r.items.map((l, i) => (
        <div key={i} className="mb-1">
          <div className="font-bold">{l.name}</div>
          {l.modifiers.length > 0 ? (
            <div className="pl-2 text-[11px]">+ {l.modifiers.map((m) => m.name).join(", ")}</div>
          ) : null}
          <div className="flex justify-between">
            <span>
              {qtyLabel(l.qty)} × {formatKzt(l.price)}
              {!Number.isInteger(l.qty) ? "/кг" : ""}
            </span>
            <span>{formatKzt(l.total)}</span>
          </div>
        </div>
      ))}
      {r.note ? <div className="mt-1">Примечание: {r.note}</div> : null}
      <Divider />
      <Row label="Сумма" value={formatKzt(r.subtotal)} />
      {r.discount > 0 && <Row label="Скидка" value={"-" + formatKzt(r.discount)} />}
      {r.shop.vatPercent > 0 && (
        <Row
          label={`в т.ч. НДС ${r.shop.vatPercent}%`}
          value={formatKzt((r.total * r.shop.vatPercent) / (100 + r.shop.vatPercent))}
        />
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>ИТОГО</span>
        <span>{formatKzt(r.total)}</span>
      </div>
      <Divider />
      <Row label="Оплата" value={PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod} />
      {r.cashAmount > 0 && <Row label="Наличными" value={formatKzt(r.cashAmount)} />}
      {r.cardAmount > 0 && <Row label="Картой" value={formatKzt(r.cardAmount)} />}
      {r.cashReceived > 0 && <Row label="Получено" value={formatKzt(r.cashReceived)} />}
      {r.changeGiven > 0 && <Row label="Сдача" value={formatKzt(r.changeGiven)} />}
      {r.bonusUsed > 0 && <Row label="Списано бонусов" value={String(r.bonusUsed)} />}
      {r.bonusEarned > 0 && <Row label="Начислено бонусов" value={String(r.bonusEarned)} />}
      {r.fiscalNumber ? (
        <>
          <Divider />
          <div className="text-center">Фискальный чек Kaspi № {r.fiscalNumber}</div>
        </>
      ) : null}
      <Divider />
      <div className="text-center">Статус: {ORDER_STATUS_LABELS[r.status] ?? r.status}</div>
    </div>
  );
}

/** Чек покупателя: номер заказа и состав — минимум информации. */
export function CustomerReceipt({ r }: { r: ReceiptPayload }) {
  return (
    <div className={sheet}>
      <div className="text-center text-sm font-bold uppercase">{r.shop.name}</div>
      <div className="mt-1 text-center">Ваш номер заказа</div>
      <div className="text-center text-5xl font-bold leading-tight">{r.dailyNo}</div>
      <Divider />
      {r.items.map((l, i) => (
        <div key={i} className="flex justify-between">
          <span>
            {l.name}
            {Number.isInteger(l.qty) ? ` x${l.qty}` : ` · ${qtyLabel(l.qty)}`}
          </span>
          <span>{formatKzt(l.total)}</span>
        </div>
      ))}
      <Divider />
      <div className="flex justify-between text-sm font-bold">
        <span>ИТОГО</span>
        <span>{formatKzt(r.total)}</span>
      </div>
      <div className="text-center">{ORDER_TYPE_LABELS[r.orderType] ?? ""}</div>
      {r.bonusEarned > 0 ? (
        <div className="text-center">Бонусов начислено: {r.bonusEarned}</div>
      ) : null}
      {r.fiscalCheckUrl ? (
        <div className="mt-2 flex justify-center">
          <QRCode value={r.fiscalCheckUrl} size={104} bgColor="#ffffff" fgColor="#000000" />
        </div>
      ) : null}
      <Divider />
      <div className="text-center">{r.shop.footer || "Спасибо за покупку!"}</div>
    </div>
  );
}

/** Оба чека сразу: печатаются последовательно на одном принтере. */
export function ReceiptPair({
  r,
  cashier = true,
  customer = true,
}: {
  r: ReceiptPayload;
  cashier?: boolean;
  customer?: boolean;
}) {
  return (
    <div className="print-area grid gap-4">
      {cashier ? <CashierReceipt r={r} /> : null}
      {customer ? <CustomerReceipt r={r} /> : null}
    </div>
  );
}
