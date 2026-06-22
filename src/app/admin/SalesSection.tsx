"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing, ShippingStatus } from "@/lib/db";
import ShippingLabelModal from "./ShippingLabelModal";

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

type FilterOption = "ALL" | ShippingStatus;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "ALL", label: "Alle" },
  { value: "AWAITING_LABEL", label: "Wachten op label" },
  { value: "LABEL_SENT", label: "Label verzonden" },
  { value: "IN_TRANSIT", label: "Onderweg" },
  { value: "RECEIVED", label: "Ontvangen" },
  { value: "SHIPPED_TO_CUSTOMER", label: "Verzonden naar klant" },
];

type StatusTagProps = { status: ShippingStatus };

function StatusTag({ status }: StatusTagProps) {
  const config: Record<ShippingStatus, { label: string; color: string; bg: string; border: string }> = {
    AWAITING_LABEL: {
      label: "Wachten op label",
      color: "#8f8b80",
      bg: "rgba(143,139,128,0.1)",
      border: "rgba(143,139,128,0.35)",
    },
    LABEL_SENT: {
      label: "Label verzonden",
      color: "#60a5fa",
      bg: "rgba(96,165,250,0.1)",
      border: "rgba(96,165,250,0.35)",
    },
    IN_TRANSIT: {
      label: "Onderweg",
      color: "#e8b84b",
      bg: "rgba(232,184,75,0.1)",
      border: "rgba(232,184,75,0.35)",
    },
    RECEIVED: {
      label: "Ontvangen",
      color: "#c084fc",
      bg: "rgba(192,132,252,0.1)",
      border: "rgba(192,132,252,0.35)",
    },
    SHIPPED_TO_CUSTOMER: {
      label: "Verzonden naar klant",
      color: "#6fd49a",
      bg: "rgba(111,212,154,0.1)",
      border: "rgba(111,212,154,0.35)",
    },
  };

  const { label, color, bg, border } = config[status];

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "4px 9px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function SalesSection({ initialListings }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingWithConsigner[]>(initialListings);
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [labelTarget, setLabelTarget] = useState<ListingWithConsigner | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const filtered =
    filter === "ALL"
      ? listings
      : listings.filter((l) => l.shipping_status === filter);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function advanceStatus(listing: ListingWithConsigner, newStatus: ShippingStatus) {
    setLoadingId(listing.id);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}/shipping-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Update mislukt.");
      } else {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listing.id ? { ...l, shipping_status: newStatus } : l
          )
        );
        showSuccess(`Status bijgewerkt ✓`);
        router.refresh();
      }
    } catch {
      alert("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoadingId(null);
    }
  }

  function handleLabelSuccess(listingId: number) {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId ? { ...l, shipping_status: "LABEL_SENT" } : l
      )
    );
    setLabelTarget(null);
    showSuccess("Label opgeslagen, status → Label verzonden ✓");
    router.refresh();
  }

  function renderAction(l: ListingWithConsigner) {
    const busy = loadingId === l.id;

    switch (l.shipping_status) {
      case "AWAITING_LABEL":
        return (
          <button
            className="btn sm"
            type="button"
            disabled={busy}
            onClick={() => setLabelTarget(l)}
            style={{ background: "rgba(143,139,128,0.15)", color: "#8f8b80" }}
          >
            Label uploaden
          </button>
        );
      case "LABEL_SENT":
        return (
          <button
            className="btn sm"
            type="button"
            disabled={busy}
            onClick={() => advanceStatus(l, "IN_TRANSIT")}
            style={{ background: "rgba(232,184,75,0.15)", color: "#e8b84b" }}
          >
            {busy ? "…" : "Markeer onderweg"}
          </button>
        );
      case "IN_TRANSIT":
        return (
          <button
            className="btn sm"
            type="button"
            disabled={busy}
            onClick={() => advanceStatus(l, "RECEIVED")}
            style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}
          >
            {busy ? "…" : "Markeer ontvangen"}
          </button>
        );
      case "RECEIVED":
        return (
          <button
            className="btn sm"
            type="button"
            disabled={busy}
            onClick={() => advanceStatus(l, "SHIPPED_TO_CUSTOMER")}
            style={{ background: "rgba(111,212,154,0.15)", color: "#6fd49a" }}
          >
            {busy ? "…" : "Markeer verzonden naar klant"}
          </button>
        );
      case "SHIPPED_TO_CUSTOMER":
        return (
          <a
            href="#payouts"
            className="btn sm"
            style={{ background: "rgba(111,212,154,0.15)", color: "#6fd49a" }}
          >
            Klaar voor uitbetaling
          </a>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          margin: "32px 0 12px",
        }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          Verkopen ({listings.length})
        </h2>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "opacity 0.15s",
                ...(filter === opt.value
                  ? {
                      background: "var(--accent)",
                      color: "#0c0c0b",
                      borderColor: "var(--accent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--muted)",
                      borderColor: "var(--line)",
                    }),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
        {filtered.length === 0 ? (
          <div className="empty">
            {filter === "ALL"
              ? "Geen verkopen gevonden."
              : "Geen verkopen met deze status."}
          </div>
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
                <th>Shipping status</th>
                <th>Tracking</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
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
                  <td>
                    {l.shipping_status ? (
                      <StatusTag status={l.shipping_status} />
                    ) : (
                      <span className="size-chip">—</span>
                    )}
                  </td>
                  <td>
                    {l.shipping_tracking_code ? (
                      <span className="sku">{l.shipping_tracking_code}</span>
                    ) : (
                      <span className="size-chip">—</span>
                    )}
                  </td>
                  <td>{renderAction(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {labelTarget && (
        <ShippingLabelModal
          listingId={labelTarget.id}
          onClose={() => setLabelTarget(null)}
          onSuccess={handleLabelSuccess}
        />
      )}
    </>
  );
}
