import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/pos-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Настройки точки и чека" },
      {
        name: "description",
        content: "Название точки, адрес, телефон, НДС и текст в подвале кассового чека.",
      },
      { property: "og:title", content: "Настройки точки и чека" },
      { property: "og:description", content: "Реквизиты точки и оформление чека." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [form, setForm] = useState({
    shop_name: "",
    address: "",
    phone: "",
    receipt_footer: "",
    vat_percent: "0",
    auto_print: true,
    print_copies: "1",
    print_cashier_receipt: true,
    print_customer_receipt: true,
    printer_name: "",
    kaspi_enabled: false,
    kaspi_api_url: "",
    kaspi_terminal_id: "",
    kaspi_bin: "",
  });

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      shop_name: settings.data.shop_name,
      address: settings.data.address,
      phone: settings.data.phone,
      receipt_footer: settings.data.receipt_footer,
      vat_percent: String(settings.data.vat_percent),
      auto_print: settings.data.auto_print,
      print_copies: String(settings.data.print_copies),
      print_cashier_receipt: settings.data.print_cashier_receipt,
      print_customer_receipt: settings.data.print_customer_receipt,
      printer_name: settings.data.printer_name ?? "",
      kaspi_enabled: settings.data.kaspi_enabled,
      kaspi_api_url: settings.data.kaspi_api_url,
      kaspi_terminal_id: settings.data.kaspi_terminal_id,
      kaspi_bin: settings.data.kaspi_bin,
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        id: true,
        shop_name: form.shop_name.trim() || "Точка",
        address: form.address,
        phone: form.phone,
        receipt_footer: form.receipt_footer,
        vat_percent: Number(form.vat_percent) || 0,
        auto_print: form.auto_print,
        print_copies: Math.min(3, Math.max(1, Number(form.print_copies) || 1)),
        print_cashier_receipt: form.print_cashier_receipt,
        print_customer_receipt: form.print_customer_receipt,
        printer_name: form.printer_name.trim(),
        kaspi_enabled: form.kaspi_enabled,
        kaspi_api_url: form.kaspi_api_url.trim(),
        kaspi_terminal_id: form.kaspi_terminal_id.trim(),
        kaspi_bin: form.kaspi_bin.trim(),
      };
      const { error } = await supabase.from("settings").upsert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Настройки сохранены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Настройки</h1>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Точка и чек</h2>
        <div className="grid gap-1.5">
          <Label>Название точки</Label>
          <Input
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Адрес</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Телефон</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>НДС, %</Label>
          <Input
            inputMode="decimal"
            value={form.vat_percent}
            onChange={(e) => setForm({ ...form, vat_percent: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Текст внизу чека</Label>
          <Textarea
            rows={3}
            value={form.receipt_footer}
            onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Печать чеков</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Печатать чек автоматически после оплаты</span>
          <Switch
            checked={form.auto_print}
            onCheckedChange={(v) => setForm({ ...form, auto_print: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Печатать чек кассира (для выполнения заказа)</span>
          <Switch
            checked={form.print_cashier_receipt}
            onCheckedChange={(v) => setForm({ ...form, print_cashier_receipt: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Печатать чек покупателя (номер заказа)</span>
          <Switch
            checked={form.print_customer_receipt}
            onCheckedChange={(v) => setForm({ ...form, print_customer_receipt: v })}
          />
        </label>
        <div className="grid gap-1.5">
          <Label>Копий чека</Label>
          <Input
            inputMode="numeric"
            value={form.print_copies}
            onChange={(e) => setForm({ ...form, print_copies: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Принтер чеков</Label>
          <Input
            value={form.printer_name}
            placeholder="Например: Xprinter XP-58"
            onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Укажите название принтера — оно будет показано кассиру как подсказка. Сам принтер
            выбирается в системе (см. инструкцию ниже): браузер не разрешает сайту менять принтер.
          </p>
        </div>
        <div className="rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground">
          <p className="font-semibold text-foreground">Как сделать печать сразу на нужный принтер:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              В системе планшета/компьютера назначьте этот принтер принтером по умолчанию
              (Windows: Параметры → Принтеры → нужный принтер → «По умолчанию»).
            </li>
            <li>
              Запускайте кассу в Chrome в режиме киоска: создайте ярлык Chrome и в поле «Объект»
              допишите{" "}
              <code className="rounded bg-background px-1">
                --kiosk-printing --kiosk &quot;адрес кассы&quot;
              </code>
              .
            </li>
            <li>
              Откройте кассу через этот ярлык — после оплаты чек уйдёт на принтер по умолчанию
              автоматически, без окна выбора принтера.
            </li>
          </ol>
          <p className="mt-1">Чек рассчитан на ленту шириной 58 мм.</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Kaspi Касса</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Отправлять чеки в Kaspi Касса (фискализация и QR)</span>
          <Switch
            checked={form.kaspi_enabled}
            onCheckedChange={(v) => setForm({ ...form, kaspi_enabled: v })}
          />
        </label>
        <div className="grid gap-1.5">
          <Label>Адрес Kaspi API</Label>
          <Input
            value={form.kaspi_api_url}
            placeholder="https://mtoken.kaspi.kz:8545/r3/v01"
            onChange={(e) => setForm({ ...form, kaspi_api_url: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Номер терминала Kaspi Pay</Label>
          <Input
            value={form.kaspi_terminal_id}
            onChange={(e) => setForm({ ...form, kaspi_terminal_id: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>БИН / ИИН точки</Label>
          <Input
            value={form.kaspi_bin}
            onChange={(e) => setForm({ ...form, kaspi_bin: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Токен устройства Kaspi хранится отдельно и в настройках не показывается.
        </p>
      </section>

      <Button className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate()}>
        Сохранить
      </Button>
    </div>
  );
}
