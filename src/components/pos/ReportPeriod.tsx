import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customSalesRange, salesRange, type SalesPeriod } from "@/lib/sales";

export function useReportPeriod() {
  const [period, setPeriod] = useState<SalesPeriod | "custom">("today");
  const [customRange, setCustomRange] = useState(() => salesRange("today"));
  return {
    period, setPeriod,
    range: period === "custom" ? customRange : salesRange(period),
    apply: (start: string, end: string) => {
      setCustomRange(customSalesRange(start, end));
      setPeriod("custom");
    },
  };
}

export function ReportPeriod({ selection }: { selection: ReturnType<typeof useReportPeriod> }) {
  const [start, setStart] = useState(() => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10));
  const [end, setEnd] = useState(start);
  const [error, setError] = useState("");
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {([["today", "Сегодня"], ["week", "7 дней"], ["month", "30 дней"]] as const).map(([key, label]) =>
        <Button key={key} size="sm" variant={selection.period === key ? "default" : "secondary"} onClick={() => { selection.setPeriod(key); setError(""); }}>{label}</Button>)}
      <Button size="sm" variant={selection.period === "custom" ? "default" : "secondary"} onClick={() => selection.setPeriod("custom")}><CalendarDays className="size-4" />Любой период</Button>
    </div>
    {selection.period === "custom" && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault();
      try { selection.apply(start, end); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Проверьте даты"); }
    }}>
      <label className="min-w-0 space-y-1 text-sm">С даты<Input aria-label="С даты" className="w-40 max-w-full" type="date" required value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label className="min-w-0 space-y-1 text-sm">По дату<Input aria-label="По дату" className="w-40 max-w-full" type="date" required value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <Button type="submit" size="sm">Показать</Button>
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </form>}
  </div>;
}