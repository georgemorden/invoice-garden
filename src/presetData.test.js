import { describe, expect, it } from "vitest";
import { normalizeCurrency, readPresetRecords } from "./presetData";

describe("preset input validation", () => {
  it("accepts supported currencies and rejects inherited object keys and nonstrings", () => {
    for (const currency of ["GBP", "USD", "EUR"]) {
      expect(normalizeCurrency(currency)).toBe(currency);
    }
    for (const currency of ["constructor", "__proto__", "toString", "JPY", null, {}, ["USD"]]) {
      expect(normalizeCurrency(currency)).toBe("GBP");
    }
  });

  it("retains valid preset data alongside malformed records without retaining coercion objects", () => {
    const records = readPresetRecords(JSON.stringify([
      null,
      { id: {}, name: "Invalid id", values: {} },
      { id: "bad", name: {}, values: {} },
      { id: "bad-values", name: "Invalid values", values: [] },
      { id: "good", name: "Client", updatedAt: { toString: null }, values: {
        businessName: "Studio", hourlyRate: 45, currency: "USD",
        clientName: { toString: null }, unknown: null,
      } },
    ]));
    expect(records).toEqual([{
      id: "good", name: "Client", updatedAt: "",
      values: { businessName: "Studio", hourlyRate: 45, currency: "USD" },
    }]);
    expect(() => Date.parse(records[0].updatedAt)).not.toThrow();
  });

  it("treats malformed JSON and non-array storage as empty", () => {
    for (const value of [null, "{", "null", "{}", "42"]) {
      expect(readPresetRecords(value)).toEqual([]);
    }
  });
});
