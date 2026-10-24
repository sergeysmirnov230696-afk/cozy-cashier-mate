import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/lib/pos-queries";
import { formatKzt, PAYMENT_LABELS } from "@/lib/pos";
import { paymentSplit } from "@/lib/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumPad } from "./NumPad";

export function PaymentCorrection({ order, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState(order.payment_method);
  const [card, setCard] = useState(order.card_amount);
  const [received, setReceived] = useState(order.cash_received);
  const [field, setField] = useState<"card" | "cash">("cash");
  const cash = method === "card" ? 0 : method === "cash" ? order.total : order.total - card;
  const save = useMutation({
    mutationFn: async () => {
      paymentSplit(order.total, method, card, received);
      const { data, error } = await supabase.rpc("correct_order_payment", {
        p_order_id: order.id, p_method: method, p_card: card, p_received: received,
        p_expected: { payment_method: order.payment_method, cash_amount: order.cash_amount, card_amount: order.card_amount, cash_received: order.cash_received, change_given: order.change_given },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      for (const key of ["orders", "order_items", "shifts", "shift-report", "shift", "audit_log"]) qc.invalidateQueries({ queryKey: [key] });
      toast.success("Способ оплаты исправлен");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Оплата чека №{order.order_no}</DialogTitle></DialogHeader>
      <p className="text-xl font-bold">{formatKzt(order.total)}</p>
      <div className="flex flex-wrap gap-2">{["cash", "card", "mixed"].map((key) => <Button key={key} variant={method === key ? "default" : "secondary"} onClick={() => { setMethod(key); setField(key === "mixed" ? "card" : "cash"); if (key === "cash") setReceived(order.total); }}>{PAYMENT_LABELS[key]}</Button>)}</div>
      {method === "mixed" && <label className="space-y-2 text-sm">По карте<Input aria-label="По карте" type="number" min={0} max={order.total} value={card} onFocus={() => setField("card")} onChange={(e) => setCard(Number(e.target.value))} /></label>}
      {method !== "card" && <>
        <p className="text-sm">Наличными к оплате: {formatKzt(cash)}</p>
        <label className="space-y-2 text-sm">Получено наличными<Input aria-label="Получено наличными" type="number" min={0} value={received} onFocus={() => setField("cash")} onChange={(e) => setReceived(Number(e.target.value))} /></label>
        <NumPad value={field === "card" && method === "mixed" ? card : received} onChange={field === "card" && method === "mixed" ? setCard : setReceived} />
        <p className={received < cash ? "text-destructive" : "text-muted-foreground"}>{received < cash ? "Наличных недостаточно" : `Сдача: ${formatKzt(received - cash)}`}</p>
      </>}
      {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
      <DialogFooter><Button variant="secondary" disabled={save.isPending} onClick={onClose}>Отмена</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Сохранение…" : "Сохранить оплату"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}