"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRequest } from "@/lib/db";

type Props = {
  initialRequests: ProductRequest[];
};

const STATUS_LABEL: Record<ProductRequest["status"], string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  LIVE: "Live",
  REJECTED: "Rejected",
};

function StatusBadge({ status }: { status: ProductRequest["status"] }) {
  const bg =
    status === "PENDING" ? "rgba(160,160,160,0.15)" :
    status === "APPROVED" ? "rgba(59,130,246,0.15)" :
    status === "LIVE" ? "rgba(111,212,154,0.15)" :
    "rgba(224,112,112,0.15)";
  const color =
    status === "PENDING" ? "var(--muted)" :
    status === "APPROVED" ? "#60a5fa" :
    status === "LIVE" ? "var(--green)" :
    "#e87070";

  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function ProductRequestsSection({ initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<ProductRequest[]>(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!window.confirm("Are you sure you want to delete this request?")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setLoadingId(id);
    try {
      const res = await fetch(`/api/product-requests/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed.");
      } else {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setSuccess("Request deleted ✓");
        setTimeout(() => setSuccess(null), 3000);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <h2 className="section-title">My Product Requests</h2>

      {error && <div className="error">{error}</div>}
      {success && (
        <div
          style={{
            background: "rgba(111, 212, 154, 0.08)",
            border: "1px solid rgba(111, 212, 154, 0.35)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12,
            color: "var(--green)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      <div className="table-wrap">
        {requests.length === 0 ? (
          <div className="empty">You haven't submitted any product requests yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><span className="sku">{r.sku}</span></td>
                  <td>{r.product_name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.created_at.slice(0, 10)}</td>
                  <td>
                    <button
                      className="btn danger sm"
                      type="button"
                      disabled={loadingId === r.id}
                      onClick={() => handleDelete(r.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
