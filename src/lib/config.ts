export function feePct(): number {
  const v = parseFloat(process.env.FEE_PCT || "15");
  return isNaN(v) || v < 0 || v >= 100 ? 15 : v;
}

/**
 * Fee wordt gepakt over de verkoopprijs.
 * verkoopprijs = payout / (1 - fee%), afgerond naar hele euro's omhoog.
 * Voorbeeld: payout 170, fee 15% => 170 / 0.85 = 200
 */
export function computeSalePrice(payout: number): number {
  return Math.ceil(payout / (1 - feePct() / 100));
}

export function normalizeSku(styleCode: string, size: string): string {
  const clean = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
  return `${clean(styleCode)}-${clean(size)}`;
}

export function euro(n: number): string {
  return `€${n.toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
