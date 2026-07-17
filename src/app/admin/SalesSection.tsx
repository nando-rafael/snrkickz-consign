"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/db";

async function downloadLabel(listingId: number) {
  const res = await fetch(`/api/listings/${listingId}/label/download`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || "Label downloaden mislukt.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `listing-${listingId}-label.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function handleResendNotification(listing: ListingWithConsigner) {
    if (!window.confirm(`Melding opnieuw verzenden naar ${listing.consigner_name}?`)) {
      return;
    }

    setNotifyingId(listing.id);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}/resend-notification`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Melding verzenden mislukt.");
      } else {
        showSuccess(`Melding verzonden naar ${listing.consigner_name} ✓`);
        router.refresh();
      }
    } catch {
      alert("Netwerkfout. Probeer opnieuw.");
    } finally {
      setNotifyingId(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, listingId: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Alleen PDF bestanden zijn toegestaan.");
      e.target.value = "";
      return;
    }

    setSavingId(listingId);
    setUploadingId(listingId);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/admin/listings/${listingId}/label`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Uploaden mislukt.");
      } else {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId ? { ...l, shipping_label_url: data.labelUrl } : l
          )
        );
        showSuccess("Label opgeslagen ✓");
        router.refresh();
      }
    } catch {
      alert("Netwerkfout. Probeer opnieuw.");
    } finally {
      setSavingId(null);
      setUploadingId(null);
      // Reset the file input so the same file can be re-selected if needed
      const input = fileInputRefs.current.get(listingId);
      if (input) input.value = "";
    }
  }

  function triggerFileInput(listingId: number) {
    fileInputRefs.current.get(listingId)?.click();
  }

  function renderLabelCell(l: ListingWithConsigner) {
    const busy = savingId === l.id;
    const uploading = uploadingId === l.id;

    const hiddenInput = (
      <input
        key={`file-input-${l.id}`}
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => handleFileUpload(e, l.id)}
        style={{ display: "none" }}
        ref={(el) => {
          if (el) fileInputRefs.current.set(l.id, el);
          else fileInputRefs.current.delete(l.id);
        }}
      />
    );

    if (l.shipping_label_url) {
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {hiddenInput}
          <a
            href={l.shipping_label_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}
          >
            Label ✓
          </a>
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy}
            onClick={() => triggerFileInput(l.id)}
          >
            {uploading ? "…" : "Wijzigen"}
          </button>
          <button
            className="btn sm"
            type="button"
            onClick={() => downloadLabel(l.id)}
            style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
          >
            Download ↓
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {hiddenInput}
        <button
          className="btn sm"
          type="button"
          disabled={busy}
          onClick={() => triggerFileInput(l.id)}
          style={{ background: "rgba(143,139,128,0.15)", color: "#8f8b80" }}
        >
          {uploading ? "Uploaden…" : "Label toevoegen"}
        </button>
        <button
          className="btn sm"
          type="button"
          onClick={() => downloadLabel(l.id)}
          style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
        >
          Download ↓
        </button>
      </div>
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
                <th>Melding</th>
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
                  <td>
                    <button
                      className="btn sm"
                      type="button"
                      disabled={notifyingId === l.id}
                      onClick={() => handleResendNotification(l)}
                      title="Discord melding opnieuw verzenden"
                      style={{
                        background: "rgba(168,85,247,0.15)",
                        color: "#a855f7",
                      }}
                    >
                      {notifyingId === l.id ? "Verzenden…" : "🔔"}
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
