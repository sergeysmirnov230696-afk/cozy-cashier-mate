import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Flame, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { useCashier } from "@/lib/use-cashier";
import { advanceChickenBatch, listChickenBatches, startChickenBatch } from "@/lib/chicken.functions";
import { chickenWeight, chickenYield, validGrams, type ChickenBatch } from "@/lib/chicken";
import { formatDateTime } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NumPad } from "@/components/pos/NumPad";
import chickenImage from "@/assets/product-chicken.jpg";

export const Route = createFileRoute("/cashier/chicken")({
  head: () => ({ meta: [
    { title: "Курица для шаурмы — жарка и разбор | Гриль & Донер" },
    { name: "description", content: "Учёт сырого веса курицы, потерь при жарке и выхода чистого мяса для шаурмы." },
    { property: "og:title", content: "Жарка и разбор курицы | Гриль & Донер" },
    { property: "og:description", content: "Партии курицы: сырой вес, жареный вес и чистое мясо." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ChickenScreen,
});

type Entry = { stage: "start"; id: string } | { stage: "roast" | "strip"; batch: ChickenBatch };

function ChickenScreen() {
  const cashier = useCashier();
  const qc = useQueryClient();
  const list = useServerFn(listChickenBatches);
  const start = useServerFn(startChickenBatch);
  const advance = useServerFn(advanceChickenBatch);
  const batches = useQuery({ queryKey: ["cashier", "chicken"], queryFn: () => list(), enabled: !!cashier.data, refetchInterval: 30_000 });
  const [entry, setEntry] = useState<Entry | null>(null);
  const [weight, setWeight] = useState(0);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"active" | "done">("active");
  const save = useMutation({
    mutationFn: async () => {
      if (!entry) return;
      if (entry.stage === "start") await start({ data: { id: entry.id, rawGrams: weight, note } });
      else await advance({ data: { id: entry.batch.id, stage: entry.stage, weight } });
    },
    onSuccess: () => { setEntry(null); qc.invalidateQueries({ queryKey: ["cashier", "chicken"] }); toast.success("Вес сохранён"); },
    onError: (error: Error) => { toast.error(error.message); qc.invalidateQueries({ queryKey: ["cashier", "chicken"] }); },
  });
  function open(next: Entry) { setEntry(next); setWeight(0); setNote(""); }
  const previous = entry && entry.stage !== "start" ? (entry.stage === "roast" ? entry.batch.raw_grams : entry.batch.roasted_grams ?? 0) : null;
  const valid = validGrams(weight) && (previous === null || weight <= previous);
  const rows = (batches.data ?? []).filter((b) => tab === "active" ? b.meat_grams === null : b.meat_grams !== null);
  const title = entry?.stage === "start" ? "Поставить курицу на жарку" : entry?.stage === "roast" ? "Завершить жарку" : "Разобрать на мясо";
  const weightLabel = entry?.stage === "start" ? "Сырой вес с костями, г" : entry?.stage === "roast" ? "Жареный вес до разбора, г" : "Чистое мясо для шаурмы, г";

  return <main className="min-h-dvh bg-background">
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
      <Button asChild variant="secondary" size="sm"><Link to="/cashier"><ArrowLeft className="size-4" />Касса</Link></Button>
      <h1 className="text-lg font-bold">Жарка и разбор</h1>
      <span className="ml-auto text-sm text-muted-foreground">{cashier.data?.name}</span>
    </header>
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><img src={chickenImage} alt="Курица гриль" className="size-16 rounded-lg object-cover" /><div><h2 className="text-2xl font-bold">Курица для шаурмы</h2><p className="mt-1 text-sm text-muted-foreground">Жарится → Ожидает разбора → Разобрана</p></div></div>
        <Button disabled={!cashier.data || batches.isError} onClick={() => open({ stage: "start", id: crypto.randomUUID() })}><Plus className="size-4" />На жарку</Button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant={tab === "active" ? "default" : "secondary"} onClick={() => setTab("active")}>В работе · {(batches.data ?? []).filter(b => b.meat_grams === null).length}</Button>
        <Button variant={tab === "done" ? "default" : "secondary"} onClick={() => setTab("done")}>Разобраны · последние 100</Button>
      </div>
      {(cashier.isPending || batches.isPending) && <p className="py-8 text-muted-foreground">Загрузка партий…</p>}
      {(cashier.isError || batches.isError) && <div className="py-6"><p className="mb-3 text-destructive">Учёт жарки недоступен. Проверьте связь.</p><Button variant="secondary" onClick={() => { cashier.refetch(); batches.refetch(); }}>Повторить</Button></div>}
      {!batches.isPending && !batches.isError && rows.length === 0 && <p className="py-8 text-muted-foreground">{tab === "active" ? "Нет партий в работе" : "Нет разобранных партий"}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(b => <article key={b.id} className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold"><Flame className="size-4 text-primary" />{b.meat_grams !== null ? "Разобрана" : b.roasted_grams !== null ? "Ожидает разбора" : "Жарится"}</div>
          <p className="text-xs text-muted-foreground">{formatDateTime(b.started_at)} · {b.employee_name}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <WeightRow label="Сырой вес (брутто)" value={chickenWeight(b.raw_grams)} />
            <WeightRow label="После жарки" value={b.roasted_grams === null ? "—" : chickenWeight(b.roasted_grams)} />
            <WeightRow label="Чистое мясо (нетто)" value={b.meat_grams === null ? "—" : chickenWeight(b.meat_grams)} />
          </dl>
          {b.roasted_grams !== null && <div className="mt-4 border-t border-border pt-3"><dl className="space-y-2 text-sm"><WeightRow label="Потери при жарке" value={chickenWeight(b.raw_grams - b.roasted_grams)} /></dl></div>}
          {b.roasted_grams !== null && b.meat_grams !== null && <YieldDetails raw={b.raw_grams} roasted={b.roasted_grams} meat={b.meat_grams} />}
          {b.note && <p className="mt-3 break-words text-sm text-muted-foreground">{b.note}</p>}
          {b.meat_grams === null && <Button className="mt-5 w-full" variant={b.roasted_grams === null ? "secondary" : "default"} onClick={() => open({ stage: b.roasted_grams === null ? "roast" : "strip", batch: b })}><Scale className="size-4" />{b.roasted_grams === null ? "Завершить жарку" : "Разобрать на мясо"}</Button>}
        </article>)}
      </div>
    </div>
    <Dialog open={!!entry} onOpenChange={(value) => { if (!value && !save.isPending) setEntry(null); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{entry?.stage === "start" ? "Партия курицы для шаурмы" : entry && "batch" in entry ? formatDateTime(entry.batch.started_at) : "Вес партии"}</DialogDescription></DialogHeader>
        <div><Label htmlFor="chicken-weight">{weightLabel}</Label><Input id="chicken-weight" className="mt-2" inputMode="numeric" value={weight || ""} disabled={save.isPending} onChange={e => setWeight(Number(e.target.value.replace(/\D/g, "")))} /></div>
        <div className="text-center text-2xl font-bold tnum">{chickenWeight(weight)}</div>
        {previous !== null && <p className="text-sm text-muted-foreground">Предыдущий вес: {chickenWeight(previous)}</p>}
        {previous !== null && weight > previous && <p role="alert" className="text-sm text-destructive">Вес не может превышать предыдущий.</p>}
        <fieldset disabled={save.isPending}><NumPad value={weight} onChange={setWeight} /></fieldset>
        {entry?.stage === "start" && <div><Label htmlFor="chicken-note">Примечание</Label><Input id="chicken-note" className="mt-2" maxLength={500} value={note} disabled={save.isPending} onChange={e => setNote(e.target.value)} /></div>}
        {entry?.stage === "strip" && valid && entry.batch.roasted_grams !== null && <YieldDetails raw={entry.batch.raw_grams} roasted={entry.batch.roasted_grams} meat={weight} />}
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Сохранение…" : entry?.stage === "start" ? "Поставить на жарку" : "Сохранить вес"}</Button>
      </DialogContent>
    </Dialog>
  </main>;
}

function WeightRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-semibold tnum">{value}</dd></div>;
}

function YieldDetails({ raw, roasted, meat }: { raw: number; roasted: number; meat: number }) {
  const result = chickenYield(raw, roasted, meat);
  return <dl className="mt-3 space-y-2 text-sm">
    <WeightRow label="Кости, кожа и обрезки" value={chickenWeight(result.strippingLoss)} />
    <WeightRow label="Общие потери" value={chickenWeight(result.totalLoss)} />
    <WeightRow label="Выход от сырого веса" value={`${result.yieldPercent.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`} />
  </dl>;
}