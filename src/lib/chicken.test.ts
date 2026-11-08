import { describe, expect, it } from "vitest";
import { chickenYield, validGrams } from "./chicken";

describe("chicken preparation", () => {
  it("uses raw whole chicken as gross weight and clean meat as net weight", () => {
    const result = chickenYield(2000, 1500, 900);
    expect(result.yieldPercent).toBe(45);
    expect(result.totalLoss).toBe(1100);
  });
  it("separates roasting loss from stripping loss", () => {
    const result = chickenYield(2000, 1500, 900);
    expect(result.roastingLoss).toBe(500);
    expect(result.roastingLossPercent).toBe(25);
    expect(result.strippingLoss).toBe(600);
    expect(result.strippingLossPercent).toBe(40);
  });
  it("rejects impossible stage weights", () => {
    expect(() => chickenYield(2000, 2100, 900)).toThrow();
    expect(() => chickenYield(2000, 1500, 1600)).toThrow();
  });
  it("records positive whole grams with no fractional gram or zero weights", () => {
    expect(validGrams(1250)).toBe(true);
    expect(validGrams(0)).toBe(false);
    expect(validGrams(1.5)).toBe(false);
    expect(validGrams(Infinity)).toBe(false);
  });
});