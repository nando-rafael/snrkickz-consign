"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/db";

type ListingWithConsigner = Listing & {
  consigner_name: string;
  consigner_email: string;
};

type Props = {
  initialListings: ListingWithConsigner[];
};

function euro(n: number): string {
  return `€${n.toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function SalesSection({ initialListings }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingWithConsigner[]>(initialListings);
  const [labelInputId, setLabelInputId] = useState<number | null>(null);
  const [labelInputValue, setLabelInputValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function saveLabel(listingId: number) {
    const url = labelInputValue.trim();
    if (!url) return;
    setSavingId(listingId);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Opslaan mislukt.");
      } else {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId ? { ...l, shipping_label_url: data.labelUrl } : l
          )
        );
        setLabelInputId(null);
        setLabelInputValue("");
        showSuccess("Label opgeslagen ✓");
        router.refresh();
      }
    } catch {
      alert("Netwerkfout. Probeer opnieuw.");
    } finally {
      setSavingId(null);
    }
  }

  function openLabelInput(listingId: number) {
    setLabelInputId(listingId);
    setLabelInputValue("");
  }

  function renderLabelCell(l: ListingWithConsigner) {
    const busy = savingId === l.id;

    if (labelInputId === l.id) {
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 260 }}>
          <input
            type="url"
            autoFocus
            placeholder="https://…/label.pdf"
            value={labelInputValue}
            onChange={(e) => setLabelInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLabel(l.id);
              if (e.key === "Escape") { setLabelInputId(null); setLabelInputValue(""); }
            }}
            style={{
              flex: 1,
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "5px 9px",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            className="btn sm"
            type="button"
            disabled={busy || !labelInputValue.trim()}
            onClick={() => saveLabel(l.id)}
          >
            {busy ? "…" : "Opslaan"}
          </button>
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy}
            onClick={() => { setLabelInputId(null); setLabelInputValue(""); }}
          >
            ✕
          </button>
        </div>
      );
    }

    if (l.shipping_label_url) {
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <a
            href={l.shipping_label_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}
          >
            Label ↗
          </a>
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => openLabelInput(l.id)}
          >
            Wijzigen
          </button>
        </div>
      );
    }

    return (
      <button
        className="btn sm"
        type="button"
        onClick={() => openLabelInput(l.id)}
        style={{ background: "rgba(143,139,128,0.15)", color: "#8f8b80" }}
      >
        Label toevoegen
      </button>
    );
  }

  return (
    <>
      <h2 className="section-title" style={{ margin: "32px 0 12px" }}>
        Verkopen ({listings.length})
      </h2>

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

      <div className="table-wrap">
        {listings.length === 0 ? (
          <div className="empty">Geen verkopen gevonden.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Consigner</th>
                <th>Verkoopprijs</th>
                <th>Payout</th>
                <th>Marge</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.order_name ? (
                      <a
                        href={`https://admin.shopify.com/orders?query=${encodeURIComponent(l.order_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}
                      >
                        {l.order_name}
                      </a>
                    ) : (
                      <span className="size-chip">—</span>
                    )}
                  </td>
                  <td>
                    <div className="prod" style={{ minWidth: 200 }}>
                      {l.product_image && (
                        <img src={l.product_image} alt="" />
                      )}
                      <div>
                        <div className="t">{l.product_title ?? l.sku}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <span className="size-chip">{l.size}</span>
                          <span className="sku">{l.sku}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{l.consigner_name}</div>
                    <div className="size-chip">{l.consigner_email}</div>
                  </td>
                  <td className="num">{euro(l.sale_price_override ?? l.sale_price)}</td>
                  <td className="num">{euro(l.payout)}</td>
                  <td className="num">
                    {euro((l.sale_price_override ?? l.sale_price) - l.payout)}
                  </td>
                  <td>{renderLabelCell(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
