"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VariantOption = {
  id: string;
  size: string;
  currentPrice: number;
  maxPayout: number;
};

type Product = {
  productTitle: string;
  imageUrl: string | null;
  sku: string;
  feePct: number;
  variants: VariantOption[];
};

export default function NewListing() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [payout, setPayout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const payoutNum = parseFloat(payout) || 0;
  const selected = product?.variants.find((v) => v.id === variantId) || null;
  const salePrice =
    payoutNum > 0 && product
      ? Math.ceil(payoutNum / (1 - product.feePct / 100))
      : null;
  const tooHigh = selected !== null && payoutNum > selected.maxPayout;

  async function lookup() {
    setError(null);
    setProduct(null);
    setVariantId("");
    if (!query.trim()) {
      setError("Vul een stylecode, SKU of productnaam in.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ query });
      const res = await fetch(`/api/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Lookup mislukt.");
      } else {
        setProduct(data);
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!product || !selected) return;
    if (!payoutNum || payoutNum <= 0) {
      setError("Vul een geldige payout in.");
      return;
    }
    if (tooHigh) {
      setError(
        `Payout te hoog voor deze maat. Maximaal €${selected.maxPayout}.`
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, styleCode: product?.sku, payout: payoutNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Plaatsen mislukt.");
        setSubmitting(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
      setSubmitting(false);
    }
  }

  return (
    <main className="page container">
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Nieuwe listing
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Zoek op stylecode, SKU of productnaam — de maten komen direct uit de store.
        </p>

        {error && <div className="error">{error}</div>}

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

        {product && (
          <>
            <div className="preview">
              {product.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" />
              )}
              <div>
                <div className="title">{product.productTitle}</div>
                <div className="meta">
                  <span className="sku">{product.sku}</span>
                </div>
              </div>
              <div className="calc">
                {salePrice && !tooHigh ? (
                  <>
                    <div className="sale">€{salePrice}</div>
                    <div className="payout">jij ontvangt €{payoutNum}</div>
                  </>
                ) : (
                  <div className="meta">Kies maat + payout</div>
                )}
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="variant">Maat (EU)</label>
                <select
                  id="variant"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  <option value="">Kies maat</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      EU {v.size} — max payout €{v.maxPayout}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="payout">Jouw payout (€)</label>
                <input
                  id="payout"
                  type="number"
                  min="1"
                  step="1"
                  placeholder={selected ? `max ${selected.maxPayout}` : "—"}
                  value={payout}
                  onChange={(e) => setPayout(e.target.value)}
                />
              </div>
            </div>
            {tooHigh && selected && (
              <div className="error">
                Payout te hoog — de storeprijs voor maat {selected.size} is €
                {selected.currentPrice}. Maximale payout: €{selected.maxPayout}.
              </div>
            )}

            <button
              className="btn full"
              onClick={submit}
              disabled={submitting || !selected || !salePrice || tooHigh}
              type="button"
            >
              {submitting ? "Plaatsen…" : "Plaats listing"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
