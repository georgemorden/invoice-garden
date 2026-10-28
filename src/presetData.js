export const CURRENCY_CONFIG = {
  GBP: { symbol: "£", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};

export function normalizeCurrency(currency) {
  return typeof currency === "string" && Object.hasOwn(CURRENCY_CONFIG, currency) ? currency : "GBP";
}

// Backups and browser storage are untrusted input. Keep malformed records from
// reaching rendering, numeric coercion, or date sorting, while retaining valid siblings.
export function readPresetRecords(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((preset) =>
        preset &&
        typeof preset.id === "string" && preset.id.length > 0 && preset.id.length <= 128 &&
        typeof preset.name === "string" &&
        preset.values && typeof preset.values === "object" && !Array.isArray(preset.values),
      )
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        updatedAt: typeof preset.updatedAt === "string" ? preset.updatedAt : "",
        values: Object.fromEntries(Object.entries(preset.values).filter(([, value]) =>
          typeof value === "string" || (typeof value === "number" && Number.isFinite(value)),
        )),
      }));
  } catch {
    return [];
  }
}
