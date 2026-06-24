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
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Success state
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [failedItems, setFailedItems] = useState<{ variantId: string; error: string }[]>([]);
  // Product request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqSku, setReqSku] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqUrl, setReqUrl] = useState("");
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqSubmitting, setReqSubmitting] = useState(false);

  /** Variants that have a valid payout entered */
  const activeEntries =
    product?.variants.flatMap((v) => {
      const raw = payouts[v.id] ?? "";
      const num = parseFloat(raw);
      if (!raw || isNaN(num) || num <= 0) return [];
      const qty = Math.max(1, Math.min(10, quantities[v.id] ?? 1));
      return [{ variant: v, payout: num, quantity: qty }];
    }) ?? [];

  /** Total number of individual listings that will be created */
  const listingCount = activeEntries.reduce((sum, e) => sum + e.quantity, 0);

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
    setQuantities({});
    setSuccessCount(null);
    setFailedItems([]);
    if (!query.trim()) {
      setError("Please enter a style code, SKU, or product name.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ query });
      const res = await fetch(`/api/lookup?${params}`);
      const data: LookupResponse & { error?: string } = await res.json();
      if (res.status === 404) {
        // No products found — show the "request product" prompt
        setResults([]);
      } else if (!res.ok) {
        setError(data.error || "Lookup failed.");
      } else {
        setFeePct(data.feePct);
        setResults(data.products);
      }
    } catch {
      setError("Network error. Please try again.");
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
    setQuantities({});
    setError(null);
    setSuccessCount(null);
    setFailedItems([]);
  }

  function backToResults() {
    setProduct(null);
    setPayouts({});
    setQuantities({});
    setError(null);
    setSuccessCount(null);
    setFailedItems([]);
  }

  function setPayoutForVariant(variantId: string, value: string) {
    setPayouts((prev) => ({ ...prev, [variantId]: value }));
  }

  function setQuantityForVariant(variantId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(1, Math.min(10, value)) }));
  }

  async function submit() {
    setError(null);
    if (!product || listingCount === 0) return;
    if (hasOverpay) {
      setError("One or more payouts are too high. Please correct the fields highlighted in red.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleCode: product.sku,
          listings: activeEntries.map(({ variant, payout, quantity }) => ({
            variantId: variant.id,
            payout,
            quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed.");
        setSubmitting(false);
      } else {
        const created: { ids: number[] }[] = data.created ?? [];
        const failed: { variantId: string; error: string }[] = data.failed ?? [];
        const totalCreated = created.reduce((sum, c) => sum + (c.ids?.length ?? 1), 0);
        if (totalCreated > 0) {
          setSuccessCount(totalCreated);
          setFailedItems(failed);
          setPayouts({});
          setQuantities({});
          // Redirect after a short delay so the user sees the success message
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 2200);
        } else {
          // All failed
          setError(
            failed.map((f) => f.error).join(" · ") || "Submission failed."
          );
          setSubmitting(false);
        }
      }
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  function openRequestModal() {
    // Pre-fill SKU from the search query if it looks like a style code
    setReqSku(query.trim().toUpperCase());
    setReqName("");
    setReqUrl("");
    setReqError(null);
    setReqSuccess(false);
    setShowRequestModal(true);
  }

  function closeRequestModal() {
    setShowRequestModal(false);
    setReqError(null);
    setReqSuccess(false);
  }

  async function submitRequest() {
    setReqError(null);
    const sku = reqSku.trim().toUpperCase();
    const product_name = reqName.trim();
    const stockx_url = reqUrl.trim();

    if (!sku) { setReqError("SKU is required"); return; }
    if (!product_name) { setReqError("Product name is required"); return; }
    if (!stockx_url || !/^https:\/\/stockx\.com\//.test(stockx_url)) {
      setReqError("Only StockX links are accepted");
      return;
    }

    setReqSubmitting(true);
    try {
      const res = await fetch("/api/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, product_name, stockx_url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReqError(data.error || "Request failed.");
      } else {
        setReqSuccess(true);
        setTimeout(() => {
          closeRequestModal();
        }, 2000);
      }
    } catch {
      setReqError("Network error. Please try again.");
    } finally {
      setReqSubmitting(false);
    }
  }

  return (
    <main className="page container">
      <div
        className="card"
        style={{ maxWidth: product ? 720 : 560, margin: "0 auto", transition: "max-width 0.2s" }}
      >
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          New Listing
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Search by style code, SKU, or product name — sizes are pulled directly from the store.
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
            ✓ {successCount} listing{successCount !== 1 ? "s" : ""} created — redirecting…
            {failedItems.length > 0 && (
              <div style={{ marginTop: 8, fontWeight: 400, color: "#e8a0a0", fontSize: 13 }}>
                {failedItems.length} size{failedItems.length !== 1 ? "s" : ""} failed:{" "}
                {failedItems.map((f) => f.error).join(" · ")}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: search bar (always visible when no product selected) ── */}
        {!product && (
          <div className="field">
            <label htmlFor="query">Style code, SKU, or product name</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="query"
                placeholder="KH7719 or Air Max 90"
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
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="hint">
              Search by style code (e.g. KH7719), SKU, or part of the product name.
            </p>
          </div>
        )}

        {/* ── Step 1b: product selection list ── */}
        {!product && results && results.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p className="hint" style={{ marginBottom: 10 }}>
              {results.length === 1
                ? "1 product found — click to select."
                : `${results.length} products found — choose the correct colour/variant.`}
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
                      <span>{p.variantCount} sizes available</span>
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

        {/* ── Step 1c: no results — request product ── */}
        {!product && results !== null && results.length === 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "16px",
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <p style={{ marginBottom: 12, color: "var(--muted)", fontSize: 14 }}>
              No products found for &ldquo;{query}&rdquo;
            </p>
            <button
              className="btn ghost"
              type="button"
              onClick={openRequestModal}
            >
              Product not listed? Request it.
            </button>
          </div>
        )}

        {/* ── Product request modal ── */}
        {showRequestModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeRequestModal(); }}
          >
            <div className="card" style={{ width: "100%", maxWidth: 460 }}>
              <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
                Request a Product
              </h2>
              <p className="page-sub" style={{ marginBottom: 20 }}>
                Can&apos;t find the product? Fill in the details and we&apos;ll add it.
              </p>

              {reqSuccess ? (
                <div
                  style={{
                    background: "rgba(111, 212, 154, 0.08)",
                    border: "1px solid rgba(111, 212, 154, 0.35)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    color: "var(--green)",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  ✓ Product requested! We&apos;ll notify you once it&apos;s live.
                </div>
              ) : (
                <>
                  {reqError && <div className="error">{reqError}</div>}

                  <div className="field">
                    <label htmlFor="req-sku">SKU / Style Code</label>
                    <input
                      id="req-sku"
                      className="mono"
                      placeholder="IB3801"
                      value={reqSku}
                      onChange={(e) => setReqSku(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="req-name">Product Name</label>
                    <input
                      id="req-name"
                      placeholder="Adidas Samba OG Cloud White"
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="req-url">StockX link</label>
                    <input
                      id="req-url"
                      type="url"
                      placeholder="https://stockx.com/..."
                      value={reqUrl}
                      onChange={(e) => setReqUrl(e.target.value)}
                    />
                    <p className="hint">Only links starting with https://stockx.com/</p>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={submitRequest}
                      disabled={reqSubmitting}
                      style={{ flex: 1 }}
                    >
                      {reqSubmitting ? "Submitting…" : "Request Product"}
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={closeRequestModal}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
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
                    size{listingCount !== 1 ? "s" : ""} selected
                  </div>
                </div>
              )}
            </div>

            {/* Size table */}
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Size (EU)</th>
                    <th className="num">Store Price</th>
                    <th className="num">Max Payout</th>
                    <th className="num">Your Payout (€)</th>
                    <th className="num">Sale Price</th>
                    <th className="num">Qty</th>
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
                        <td className="num" style={{ width: 80 }}>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            value={quantities[v.id] ?? 1}
                            onChange={(e) => setQuantityForVariant(v.id, parseInt(e.target.value, 10) || 1)}
                            style={{
                              textAlign: "right",
                              padding: "7px 10px",
                              fontSize: 13,
                              width: "100%",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="hint" style={{ marginBottom: 16 }}>
              Leave a field empty to skip that size. The sale price is calculated live.
            </p>

            <button
              className="btn full"
              onClick={submit}
              disabled={submitting || listingCount === 0 || hasOverpay}
              type="button"
            >
              {submitting
                ? "Submitting…"
                : listingCount === 0
                ? "Enter at least one payout"
                : `Submit ${listingCount} listing${listingCount !== 1 ? "s" : ""}`}
            </button>

            <button
              className="btn ghost full"
              onClick={backToResults}
              disabled={submitting}
              type="button"
              style={{ marginTop: 8 }}
            >
              ← Choose a different colour
            </button>
          </>
        )}
      </div>
    </main>
  );
}
