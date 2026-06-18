"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VariantOption = {
  id: string;
  size: string;
  currentPrice: number;
  maxPayout: number;
};

type ProductResult = {
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  sku: string;
  variantCount: number;
  variants: VariantOption[];
};

type LookupResponse = {
  feePct: number;
  products: ProductResult[];
};

// The product the consigner has chosen to list
type SelectedProduct = {
  productTitle: string;
  imageUrl: string | null;
  sku: string;
  feePct: number;
  variants: VariantOption[];
};

export default function NewListing() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Step 1: list of search results
  const [results, setResults] = useState<ProductResult[] | null>(null);
  const [feePct, setFeePct] = useState(0);
  // Step 2: chosen product + per-size payouts
  const [product, setProduct] = useState<SelectedProduct | null>(null);
  const [payouts, setPayouts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Success state
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [failedItems, setFailedItems] = useState<{ variantId: string; error: string }[]>([]);

  /** Variants that have a valid payout entered */
  const activeEntries =
    product?.variants.flatMap((v) => {
      const raw = payouts[v.id] ?? "";
      const num = parseFloat(raw);
      if (!raw || isNaN(num) || num <= 0) return [];
      return [{ variant: v, payout: num }];
    }) ?? [];

  const listingCount = activeEntries.length;

  /** True if any entered payout exceeds the variant's maxPayout */
  const hasOverpay =
    product?.variants.some((v) => {
      const raw = payouts[v.id] ?? "";
      const num = parseFloat(raw);
      return raw && !isNaN(num) && num > v.maxPayout;
    }) ?? false;

  function calcSalePrice(payout: number): number {
    if (!product) return 0;
    return Math.ceil(payout / (1 - product.feePct / 100));
  }

  async function lookup() {
    setError(null);
    setResults(null);
    setProduct(null);
    setPayouts({});
    setSuccessCount(null);
    setFailedItems([]);
    if (!query.trim()) {
      setError("Vul een stylecode, SKU of productnaam in.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ query });
      const res = await fetch(`/api/lookup?${params}`);
      const data: LookupResponse & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error || "Lookup mislukt.");
      } else {
        setFeePct(data.feePct);
        setResults(data.products);
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  function selectProduct(p: ProductResult) {
    setProduct({
      productTitle: p.productTitle,
      imageUrl: p.imageUrl,
      sku: p.sku,
      feePct,
      variants: p.variants,
    });
    setPayouts({});
    setError(null);
    setSuccessCount(null);
    setFailedItems([]);
  }

  function backToResults() {
    setProduct(null);
    setPayouts({});
    setError(null);
    setSuccessCount(null);
    setFailedItems([]);
  }

  function setPayoutForVariant(variantId: string, value: string) {
    setPayouts((prev) => ({ ...prev, [variantId]: value }));
  }

  async function submit() {
    setError(null);
    if (!product || listingCount === 0) return;
    if (hasOverpay) {
      setError("Een of meer payouts zijn te hoog. Corrigeer de rood gemarkeerde velden.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleCode: product.sku,
          listings: activeEntries.map(({ variant, payout }) => ({
            variantId: variant.id,
            payout,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Plaatsen mislukt.");
        setSubmitting(false);
      } else {
        const created: unknown[] = data.created ?? [];
        const failed: { variantId: string; error: string }[] = data.failed ?? [];
        if (created.length > 0) {
          setSuccessCount(created.length);
          setFailedItems(failed);
          setPayouts({});
          // Redirect after a short delay so the user sees the success message
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 2200);
        } else {
          // All failed
          setError(
            failed.map((f) => f.error).join(" · ") || "Plaatsen mislukt."
          );
          setSubmitting(false);
        }
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
      setSubmitting(false);
    }
  }

  return (
    <main className="page container">
      <div
        className="card"
        style={{ maxWidth: product ? 720 : 560, margin: "0 auto", transition: "max-width 0.2s" }}
      >
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Nieuwe listing
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Zoek op stylecode, SKU of productnaam — de maten komen direct uit de store.
        </p>

        {error && <div className="error">{error}</div>}

        {/* ── Success banner ── */}
        {successCount !== null && (
          <div
            style={{
              background: "rgba(111, 212, 154, 0.08)",
              border: "1px solid rgba(111, 212, 154, 0.35)",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 18,
              color: "var(--green)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ✓ {successCount} listing{successCount !== 1 ? "s" : ""} geplaatst — je wordt doorgestuurd…
            {failedItems.length > 0 && (
              <div style={{ marginTop: 8, fontWeight: 400, color: "#e8a0a0", fontSize: 13 }}>
                {failedItems.length} maat/maten mislukt:{" "}
                {failedItems.map((f) => f.error).join(" · ")}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: search bar (always visible when no product selected) ── */}
        {!product && (
          <div className="field">
            <label htmlFor="query">Stylecode, SKU of productnaam</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="query"
                placeholder="KH7719 of Air Max 90"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
              <button
                className="btn ghost"
                onClick={lookup}
                disabled={loading}
                type="button"
                style={{ whiteSpace: "nowrap" }}
              >
                {loading ? "Zoeken…" : "Zoek"}
              </button>
            </div>
            <p className="hint">
              Zoek op stylecode (bijv. KH7719), SKU of een deel van de productnaam.
            </p>
          </div>
        )}

        {/* ── Step 1b: product selection list ── */}
        {!product && results && results.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p className="hint" style={{ marginBottom: 10 }}>
              {results.length === 1
                ? "1 product gevonden — klik om te selecteren."
                : `${results.length} producten gevonden — kies de juiste kleur/variant.`}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => selectProduct(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "contain",
                        borderRadius: 4,
                        flexShrink: 0,
                        background: "var(--bg)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 4,
                        background: "var(--bg)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        lineHeight: 1.3,
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.productTitle}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      <span style={{ marginRight: 10 }}>SKU: {p.sku || "—"}</span>
                      <span>{p.variantCount} maten beschikbaar</span>
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0, color: "var(--muted)" }}
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: multi-size payout table ── */}
        {product && successCount === null && (
          <>
            {/* Product header */}
            <div className="preview" style={{ marginBottom: 20 }}>
              {product.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title">{product.productTitle}</div>
                <div className="meta" style={{ marginTop: 4 }}>
                  <span className="sku">{product.sku}</span>
                  <span style={{ marginLeft: 10 }}>
                    Fee: {product.feePct}%
                  </span>
                </div>
              </div>
              {listingCount > 0 && (
                <div className="calc">
                  <div className="sale">{listingCount}</div>
                  <div className="payout">
                    maat{listingCount !== 1 ? "en" : ""} geselecteerd
                  </div>
                </div>
              )}
            </div>

            {/* Size table */}
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Maat (EU)</th>
                    <th className="num">Storeprijs</th>
                    <th className="num">Max payout</th>
                    <th className="num">Jouw payout (€)</th>
                    <th className="num">Verkoopprijs</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const raw = payouts[v.id] ?? "";
                    const num = parseFloat(raw);
                    const hasValue = raw !== "" && !isNaN(num) && num > 0;
                    const overpay = hasValue && num > v.maxPayout;
                    const salePrice = hasValue && !overpay ? calcSalePrice(num) : null;

                    return (
                      <tr key={v.id}>
                        <td>
                          <span className="size-chip">EU {v.size}</span>
                        </td>
                        <td className="num" style={{ color: "var(--muted)" }}>
                          €{v.currentPrice}
                        </td>
                        <td className="num" style={{ color: "var(--muted)" }}>
                          €{v.maxPayout}
                        </td>
                        <td className="num" style={{ width: 130 }}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="—"
                            value={raw}
                            onChange={(e) => setPayoutForVariant(v.id, e.target.value)}
                            style={{
                              textAlign: "right",
                              padding: "7px 10px",
                              fontSize: 13,
                              borderColor: overpay
                                ? "rgba(224, 112, 112, 0.7)"
                                : undefined,
                              background: overpay
                                ? "rgba(224, 112, 112, 0.06)"
                                : undefined,
                            }}
                          />
                          {overpay && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#e8a0a0",
                                marginTop: 3,
                                textAlign: "right",
                              }}
                            >
                              max €{v.maxPayout}
                            </div>
                          )}
                        </td>
                        <td className="num">
                          {salePrice ? (
                            <span style={{ fontWeight: 700 }}>€{salePrice}</span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="hint" style={{ marginBottom: 16 }}>
              Laat een veld leeg om die maat over te slaan. De verkoopprijs wordt live berekend.
            </p>

            <button
              className="btn full"
              onClick={submit}
              disabled={submitting || listingCount === 0 || hasOverpay}
              type="button"
            >
              {submitting
                ? "Plaatsen…"
                : listingCount === 0
                ? "Vul minimaal één payout in"
                : `Plaats ${listingCount} listing${listingCount !== 1 ? "s" : ""}`}
            </button>

            <button
              className="btn ghost full"
              onClick={backToResults}
              disabled={submitting}
              type="button"
              style={{ marginTop: 8 }}
            >
              ← Andere kleur kiezen
            </button>
          </>
        )}
      </div>
    </main>
  );
}
