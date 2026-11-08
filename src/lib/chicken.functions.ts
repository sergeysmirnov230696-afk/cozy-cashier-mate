import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChickenBatch } from "./chicken";

const grams = z.number().int().positive().max(2_147_483_647);

export const listChickenBatches = createServerFn({ method: "GET" }).handler(async () => {
  const { requireCashier, db } = await import("@/lib/cashier.server");
  await requireCashier();
  const fields = "id,employee_name,raw_grams,roasted_grams,meat_grams,started_at,roasted_at,stripped_at,note";
  const [active, completed] = await Promise.all([
    db.from("chicken_batches").select(fields).is("stripped_at", null).order("started_at", { ascending: false }),
    db.from("chicken_batches").select(fields).not("stripped_at", "is", null).order("started_at", { ascending: false }).limit(100),
  ]);
  if (active.error || completed.error) throw new Error("Не удалось загрузить партии курицы. Повторите попытку.");
  return [...(active.data ?? []), ...(completed.data ?? [])] as ChickenBatch[];
});

export const startChickenBatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), rawGrams: grams, note: z.string().trim().max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { requireCashier, db } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();
    const { error } = await db.from("chicken_batches").upsert({
      id: data.id, employee_id: cashier.id, employee_name: cashier.name,
      raw_grams: data.rawGrams, note: data.note,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Не удалось сохранить партию. Проверьте связь и повторите.");
    return { ok: true };
  });

export const advanceChickenBatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), stage: z.enum(["roast", "strip"]), weight: grams }).parse(input))
  .handler(async ({ data }) => {
    const { requireCashier, db } = await import("@/lib/cashier.server");
    const cashier = await requireCashier();
    const now = new Date().toISOString();
    const query = data.stage === "roast"
      ? db.from("chicken_batches").update({ roasted_grams: data.weight, roasted_at: now, roasted_by: cashier.id })
        .eq("id", data.id).is("roasted_at", null).gte("raw_grams", data.weight)
      : db.from("chicken_batches").update({ meat_grams: data.weight, stripped_at: now, stripped_by: cashier.id })
        .eq("id", data.id).not("roasted_at", "is", null).is("stripped_at", null).gte("roasted_grams", data.weight);
    const { data: saved, error } = await query.select("id").maybeSingle();
    if (error) throw new Error("Не удалось сохранить вес. Проверьте связь и повторите.");
    if (!saved) throw new Error("Партия уже изменена или вес превышает предыдущий. Обновите список.");
    return { ok: true };
  });