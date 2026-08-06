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

/**
 * Consignor payout wordt berekend vanaf de verkoopprijs (bron van waarheid).
 * payout = verkoopprijs - 15% fee - €10 platform marge, afgerond naar hele euro's.
 * Voorbeeld: verkoopprijs 174 => Math.round(174 - 26.10 - 10) = 138
 */
export function computeConsignorPayout(salePrice: number): number {
  return Math.round(salePrice - salePrice * 0.15 - 10);
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
