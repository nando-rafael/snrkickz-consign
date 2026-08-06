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
 * Calculate consignor payout from selling price.
 * Deducts 15% platform fee and additional €10 platform margin.
 * Rounds to nearest whole euro.
 * 
 * Example: selling_price €174
 * => 174 - (174 × 0.15) - 10 = 137.90 => rounds to €138
 */
export function computePayoutFromSellingPrice(sellingPrice: number): number {
  const feeAmount = sellingPrice * (feePct() / 100);
  const platformMargin = 10;
  return Math.round(sellingPrice - feeAmount - platformMargin);
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
