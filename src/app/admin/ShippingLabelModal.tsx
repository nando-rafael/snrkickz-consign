"use client";

import { useState } from "react";
import type { ShippingCarrier } from "@/lib/db";

const CARRIERS: ShippingCarrier[] = ["UPS", "DPD", "PostNL", "DHL", "Other"];

type Props = {
  listingId: number;
  onClose: () => void;
  onSuccess: (listingId: number) => void;
};

export default function ShippingLabelModal({ listingId, onClose, onSuccess }: Props) {
  const [carrier, setCarrier] = useState<ShippingCarrier | "">("");
  const [trackingCode, setTrackingCode] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!carrier) {
      setError("Selecteer een carrier.");
      return;
    }
    if (!trackingCode.trim()) {
      setError("Vul een tracking code in.");
      return;
    }
    if (!labelUrl.trim()) {
      setError("Vul een label URL in.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier,
          trackingCode: trackingCode.trim(),
          labelUrl: labelUrl.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Opslaan mislukt.");
      } else {
        onSuccess(listingId);
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
      <div className="card" style={{ width: "100%", maxWidth: 460 }}>
        <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
          Label uploaden
        </h2>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          Vul de verzendgegevens in voor listing #{listingId}.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="carrier">Carrier</label>
            <select
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as ShippingCarrier | "")}
            >
              <option value="">Selecteer carrier…</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tracking-code">Tracking code</label>
            <input
              id="tracking-code"
              type="text"
              placeholder="1Z999AA10123456784"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="mono"
            />
          </div>

          <div className="field">
            <label htmlFor="label-url">Label URL (link naar PDF)</label>
            <input
              id="label-url"
              type="url"
              placeholder="https://…/label.pdf"
              value={labelUrl}
              onChange={(e) => setLabelUrl(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="shipping-note">Notitie voor consigner (optioneel)</label>
            <textarea
              id="shipping-note"
              placeholder="Bijv. pakket wordt opgehaald op maandag…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "11px 13px",
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              className="btn"
              type="submit"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? "Opslaan…" : "Label opslaan"}
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
