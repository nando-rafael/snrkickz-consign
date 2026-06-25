"use client";

import { useState } from "react";

type PriceMode = "fixed" | "add" | "subtract" | "addPercent" | "subtractPercent";

type PreviewItem = {
  id: number;
  oldPrice: number;
  newPrice: number;
  title: string | null;
  size: string;
};

type Props = {
  listingIds: number[];
  onClose: () => void;
  onSuccess: (updated: number) => void;
};

function euro(n: number): string {
  return `€${n.toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const MODE_LABELS: Record<PriceMode, string> = {
  fixed: "Vaste prijs (€)",
  add: "Verhoog met (€)",
  subtract: "Verlaag met (€)",
  addPercent: "Verhoog met (%)",
  subtractPercent: "Verlaag met (%)",
};

export default function BulkPriceEditModal({ listingIds, onClose, onSuccess }: Props) {
  const [priceMode, setPriceMode] = useState<PriceMode>("fixed");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isPercent = priceMode === "addPercent" || priceMode === "subtractPercent";
  const placeholder = isPercent ? "bijv. 10" : "bijv. 200";
  const unit = isPercent ? "%" : "€";

  async function handlePreview() {
    setPreviewError(null);
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      setPreviewError("Vul een geldige waarde in (groter dan 0).");
      return;
    }

    setPreviewing(true);
    try {
      const res = await fetch("/api/listings/bulk/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingIds,
          priceMode,
          value: parsed,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error || "Preview mislukt.");
      } else {
        setPreviews((data.previews ?? []).slice(0, 5));
      }
    } catch {
      setPreviewError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Vul een geldige waarde in (groter dan 0).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/listings/bulk/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds, priceMode, value: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Opslaan mislukt.");
      } else {
        onSuccess(data.updated ?? 0);
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
      <div className="card" style={{ width: "100%", maxWidth: 480 }}>
        <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
          Bulk prijsaanpassing
        </h2>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          {listingIds.length} listing{listingIds.length !== 1 ? "s" : ""} geselecteerd
        </p>

        {error && (
          <div className="error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="bulk-price-mode">Aanpassingsmodus</label>
            <select
              id="bulk-price-mode"
              value={priceMode}
              onChange={(e) => {
                setPriceMode(e.target.value as PriceMode);
                setPreviews([]);
                setPreviewError(null);
              }}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--fg)",
                padding: "8px 10px",
                fontSize: 13,
                width: "100%",
                cursor: "pointer",
              }}
            >
              {(Object.keys(MODE_LABELS) as PriceMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="bulk-price-value">
              Waarde ({unit})
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="bulk-price-value"
                type="number"
                min="0.01"
                step="0.01"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setPreviews([]);
                  setPreviewError(null);
                }}
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                type="button"
                className="btn sm"
                disabled={previewing || !value}
                onClick={handlePreview}
                style={{
                  background: "rgba(59,130,246,0.15)",
                  color: "#60a5fa",
                  whiteSpace: "nowrap",
                }}
              >
                {previewing ? "Laden…" : "Preview"}
              </button>
            </div>
          </div>

          {previewError && (
            <div
              style={{
                background: "rgba(224,112,112,0.1)",
                border: "1px solid rgba(224,112,112,0.3)",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 12,
                color: "#e87070",
                fontSize: 12,
              }}
            >
              {previewError}
            </div>
          )}

          {previews.length > 0 && (
            <div
              style={{
                background: "var(--panel-2, rgba(255,255,255,0.03))",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                Preview (eerste {previews.length})
              </div>
              {previews.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    padding: "4px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    #{p.id} {p.title} · {p.size}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>
                      {euro(p.oldPrice)}
                    </span>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>
                      → {euro(p.newPrice)}
                    </span>
                  </span>
                </div>
              ))}
              {listingIds.length > 5 && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  + {listingIds.length - 5} meer listings worden ook bijgewerkt
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              className="btn"
              type="submit"
              disabled={loading || !value}
              style={{ flex: 1 }}
            >
              {loading ? "Opslaan…" : `Opslaan (${listingIds.length})`}
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
