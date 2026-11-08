export type ChickenBatch = {
  id: string;
  employee_name: string;
  raw_grams: number;
  roasted_grams: number | null;
  meat_grams: number | null;
  started_at: string;
  roasted_at: string | null;
  stripped_at: string | null;
  note: string;
};

export function validGrams(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
}

export function chickenYield(raw: number, roasted: number, meat: number) {
  if (![raw, roasted, meat].every(validGrams) || roasted > raw || meat > roasted)
    throw new Error("Вес мяса не может превышать жареный вес, а жареный — сырой.");
  return {
    roastingLoss: raw - roasted,
    strippingLoss: roasted - meat,
    totalLoss: raw - meat,
    yieldPercent: (meat / raw) * 100,
    roastingLossPercent: ((raw - roasted) / raw) * 100,
    strippingLossPercent: ((roasted - meat) / roasted) * 100,
  };
}

export const chickenWeight = (grams: number) =>
  `${(grams / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} кг`;