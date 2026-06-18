"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRequest } from "@/lib/db";

type RequestWithConsigner = ProductRequest & {
  consigner_name: string;
  consigner_email: string;
};

type Props = {
  initialRequests: RequestWithConsigner[];
};

const STATUS_LABEL: Record<ProductRequest["status"], string> = {
  PENDING: "In behandeling",
  APPROVED: "Goedgekeurd",
  LIVE: "Live",
  REJECTED: "Afgewezen",
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
  const [requests, setRequests] = useState<RequestWithConsigner[]>(initialRequests);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  async function handleAction(id: number, action: "approve" | "reject" | "live") {
    setActionError(null);
    setSuccessMsg(null);
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/product-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Actie mislukt.");
      } else {
        const updated: RequestWithConsigner = {
          ...data.request,
          consigner_name: requests.find((r) => r.id === id)?.consigner_name ?? "?",
          consigner_email: requests.find((r) => r.id === id)?.consigner_email ?? "?",
        };
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
        const labels: Record<string, string> = {
          approve: "Goedgekeurd",
          reject: "Afgewezen",
          live: "Gemarkeerd als live",
        };
        setSuccessMsg(`${labels[action]} ✓`);
        setTimeout(() => setSuccessMsg(null), 3000);
        router.refresh();
      }
    } catch {
      setActionError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <h2 className="section-title">
        Product requests ({pendingCount} open)
      </h2>

      {actionError && <div className="error">{actionError}</div>}
      {successMsg && (
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
          {successMsg}
        </div>
      )}

      <div className="table-wrap" style={{ marginBottom: 32 }}>
        {requests.length === 0 ? (
          <div className="empty">Geen product requests.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Consigner</th>
                <th>SKU</th>
                <th>Productnaam</th>
                <th>StockX link</th>
                <th>Status</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at.slice(0, 10)}</td>
                  <td>
                    {r.consigner_name}
                    <div>
                      <span className="size-chip">{r.consigner_email}</span>
                    </div>
                  </td>
                  <td><span className="sku">{r.sku}</span></td>
                  <td>{r.product_name}</td>
                  <td>
                    <a
                      href={r.stockx_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)", fontSize: 13 }}
                    >
                      StockX ↗
                    </a>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {r.status === "PENDING" && (
                        <>
                          <button
                            className="btn sm"
                            type="button"
                            disabled={loadingId === r.id}
                            onClick={() => handleAction(r.id, "approve")}
                            style={{ background: "rgba(111,212,154,0.2)", color: "var(--green)" }}
                          >
                            Approve
                          </button>
                          <button
                            className="btn danger sm"
                            type="button"
                            disabled={loadingId === r.id}
                            onClick={() => handleAction(r.id, "reject")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <button
                          className="btn sm"
                          type="button"
                          disabled={loadingId === r.id}
                          onClick={() => handleAction(r.id, "live")}
                          style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}
                        >
                          Mark as live
                        </button>
                      )}
                    </div>
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
