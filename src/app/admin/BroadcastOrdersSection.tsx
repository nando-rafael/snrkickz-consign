"use client";

import { useState, useEffect } from "react";
import type { BroadcastOrder } from "@/lib/db";
import { euro } from "@/lib/config";

type FilterStatus = "all" | "PENDING" | "CLAIMED" | "REJECTED" | "SHIPPED" | "PAID";

export default function BroadcastOrdersSection() {
  const [orders, setOrders] = useState<BroadcastOrder[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast-orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: BroadcastOrder["status"]) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/admin/broadcast-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (e) {
      alert("Fout bij updaten");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const statusColor: Record<string, string> = {
    PENDING: "#e8b84b",
    CLAIMED: "#59a3ff",
    REJECTED: "#e07070",
    SHIPPED: "#6fd49a",
    PAID: "#8f8b80",
  };

  return (
    <div>
      <h2 className="section-title">Broadcast orders</h2>

      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterStatus)}
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "8px 12px",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          <option value="all">Alle statussen</option>
          <option value="PENDING">Pending</option>
          <option value="CLAIMED">Claimed</option>
          <option value="REJECTED">Rejected</option>
          <option value="SHIPPED">Shipped</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {loading ? (
        <div className="empty">Laden...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty">Geen orders</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Order</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Maat</th>
                <th className="num">Prijs</th>
                <th className="num">Payout</th>
                <th>Status</th>
                <th>Claimed</th>
                <th>Supplier</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {new Date(order.created_at).toLocaleDateString("nl-NL")}
                  </td>
                  <td>
                    <a
                      href={`https://shopify.com`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent)", textDecoration: "underline", fontSize: 13 }}
                    >
                      {order.shopify_order_name}
                    </a>
                  </td>
                  <td style={{ fontSize: 13, maxWidth: 200 }}>{order.product_title}</td>
                  <td>
                    <span className="sku">{order.sku}</span>
                  </td>
                  <td>
                    <span className="size-chip">EU {order.size}</span>
                  </td>
                  <td className="num">{euro(order.sale_price)}</td>
                  <td className="num" style={{ color: "var(--green)", fontWeight: 600 }}>
                    {euro(order.payout_amount)}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 9px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        color: statusColor[order.status],
                        border: `1px solid ${statusColor[order.status]}33`,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {order.claimed_at
                      ? new Date(order.claimed_at).toLocaleDateString("nl-NL")
                      : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {order.claimed_by_supplier_email || "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {order.status === "CLAIMED" && (
                      <button
                        className="btn sm"
                        onClick={() => handleStatusChange(order.id, "SHIPPED")}
                        disabled={actionLoading === order.id}
                        style={{ fontSize: 11, marginRight: 6 }}
                      >
                        Mark shipped
                      </button>
                    )}
                    {order.status === "SHIPPED" && (
                      <button
                        className="btn sm"
                        onClick={() => handleStatusChange(order.id, "PAID")}
                        disabled={actionLoading === order.id}
                        style={{ fontSize: 11, marginRight: 6 }}
                      >
                        Mark paid
                      </button>
                    )}
                    {order.status === "REJECTED" && (
                      <button
                        className="btn sm ghost"
                        onClick={() => {
                          if (confirm("Mark this order as manually sourced?")) {
                            handleStatusChange(order.id, "SHIPPED");
                          }
                        }}
                        disabled={actionLoading === order.id}
                        style={{ fontSize: 11 }}
                      >
                        Sourced
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

