"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { BroadcastOrder } from "@/lib/db";
import { euro } from "@/lib/config";

export default function ClaimPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [order, setOrder] = useState<BroadcastOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Ongeldige link: token ontbreekt");
      setLoading(false);
      return;
    }

    fetch(`/api/broadcast/claim/${params.id}?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Order niet gevonden" : "Fout bij laden");
        return res.json();
      })
      .then((data) => {
        setOrder(data.order);
        if (data.order.status !== "PENDING") {
          setError(data.message || "Deze order kan niet meer geclaimd worden");
        }
      })
      .catch((err) => setError(err.message || "Fout bij laden"))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  const handleClaim = async () => {
    if (!token) return;
    setClaiming(true);
    try {
      // Pass token as query parameter, not in body
      const res = await fetch(`/api/broadcast/claim/${params.id}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Fout bij claimen");
      }
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fout bij claimen");
    } finally {
      setClaiming(false);
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

  if (claimed) {
    return (
      <div className="container" style={{ padding: "60px 32px" }}>
        <div className="card narrow">
          <h1 style={{ fontSize: 20, marginBottom: 12, color: "var(--green)" }}>✅ Order geclaimd!</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>
            Je hebt deze order succesvol geclaimd. Verzend het paar alstublieft binnen <strong>48 uur</strong> naar Snrkickz.
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
            Shipment details zullen je via e-mail worden toegestuurd.
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
        <h1 style={{ fontSize: 20, marginBottom: 20 }}>Claim order</h1>

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
            <div>
              <p style={{ color: "var(--muted)" }}>Verkoopprijs</p>
              <p style={{ fontWeight: 600 }}>{euro(order.sale_price)}</p>
            </div>
            <div>
              <p style={{ color: "var(--muted)" }}>Jouw payout</p>
              <p style={{ fontWeight: 600, color: "var(--green)" }}>{euro(order.payout_amount)}</p>
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(111, 212, 154, 0.08)", border: "1px solid rgba(111, 212, 154, 0.2)", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13 }}>
          <p style={{ color: "var(--green)", fontWeight: 600, marginBottom: 6 }}>ℹ️ Zorg dat je dit paar op voorraad hebt</p>
          <p style={{ color: "var(--text)" }}>Door te bevestigen zeg je toe dat je dit paar direct op voorraad hebt en binnen <strong>48 uur</strong> naar Snrkickz kan verzenden.</p>
        </div>

        <button
          onClick={handleClaim}
          disabled={claiming}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "var(--green)",
            color: "#0c0c0b",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: claiming ? "wait" : "pointer",
            opacity: claiming ? 0.6 : 1,
          }}
        >
          {claiming ? "Claimen..." : "✅ Bevestig claim"}
        </button>
      </div>
    </div>
  );
}

