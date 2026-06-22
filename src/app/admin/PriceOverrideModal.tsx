"use client";

import { useState } from "react";

type Props = {
  listingId: number;
  currentPrice: number;
  onClose: () => void;
  onSuccess: (newPrice: number) => void;
};

export default function PriceOverrideModal({
  listingId,
  currentPrice,
  onClose,
  onSuccess,
}: Props) {
  const [price, setPrice] = useState(String(currentPrice));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Vul een geldige prijs in (groter dan 0).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/price-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Opslaan mislukt.");
      } else {
        onSuccess(parsed);
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
          Verkoopprijs aanpassen
        </h2>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          Huidige prijs:{" "}
          <strong>
            €
            {currentPrice.toLocaleString("nl-NL", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </strong>
          . De payout van de consigner blijft ongewijzigd.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="override-price">Nieuwe verkoopprijs (€)</label>
            <input
              id="override-price"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="200"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              className="btn"
              type="submit"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Annuleer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
