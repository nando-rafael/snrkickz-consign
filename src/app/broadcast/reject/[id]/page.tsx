"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { BroadcastOrder } from "@/lib/db";

export default function RejectPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [order, setOrder] = useState<BroadcastOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Ongeldige link: token ontbreekt");
      setLoading(false);
      return;
    }

    fetch(`/api/broadcast/reject/${params.id}?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Order niet gevonden" : "Fout bij laden");
        return res.json();
      })
      .then((data) => {
        setOrder(data.order);
        if (data.order.status !== "PENDING") {
          setError(data.message || "Deze order kan niet meer afgewezen worden");
        }
      })
      .catch((err) => setError(err.message || "Fout bij laden"))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  const handleReject = async () => {
    if (!token) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/broadcast/reject/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("Fout bij afwijzen");
      setRejected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fout bij afwijzen");
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "60px 32px" }}>
        <div className="card narrow" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>Laden...</p>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="container" style={{ padding: "60px 32px" }}>
        <div className="card narrow">
          <h1 style={{ fontSize: 20, marginBottom: 12, color: "var(--green)" }}>✅ Bedankt voor de melding!</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>
            We hebben begrepen dat je dit paar niet op voorraad hebt. Snrkickz gaat zelf aan het sourcen.
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: "60px 32px" }}>
        <div className="card narrow">
          <div className="error">{error || "Order niet gevonden"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "60px 32px" }}>
      <div className="card narrow">
        <h1 style={{ fontSize: 20, marginBottom: 20 }}>Kan je dit paar niet leveren?</h1>

        <div style={{ marginBottom: 20, padding: 16, background: "var(--panel-2)", borderRadius: 8 }}>
          {order.image_url && (
            <img
              src={order.image_url}
              alt="product"
              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 12 }}
            />
          )}
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Order: {order.shopify_order_name}</p>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{order.product_title}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            <div>
              <p style={{ color: "var(--muted)" }}>SKU</p>
              <p style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{order.sku}</p>
            </div>
            <div>
              <p style={{ color: "var(--muted)" }}>Maat</p>
              <p style={{ fontWeight: 600 }}>EU {order.size}</p>
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(224, 112, 112, 0.08)", border: "1px solid rgba(224, 112, 112, 0.2)", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13 }}>
          <p style={{ color: "#e07070", fontWeight: 600, marginBottom: 6 }}>⚠️ Deze actie is definitief</p>
          <p style={{ color: "var(--text)" }}>Snrkickz zal zelf aan het sourcing gaan. Je ontvangt geen payout voor deze order.</p>
        </div>

        <button
          onClick={handleReject}
          disabled={rejecting}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            color: "#e07070",
            border: "1px solid rgba(224, 112, 112, 0.4)",
            borderRadius: 8,
            fontWeight: 700,
            cursor: rejecting ? "wait" : "pointer",
            opacity: rejecting ? 0.6 : 1,
          }}
        >
          {rejecting ? "Afwijzen..." : "❌ Bevestig: kan niet leveren"}
        </button>
      </div>
    </div>
  );
}

