"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/db";
import PriceOverrideModal from "./PriceOverrideModal";
import BulkListingsToolbar from "@/components/BulkListingsToolbar";
import BulkPriceEditModal from "@/components/BulkPriceEditModal";

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

function getLowestAskInfo(listing: ListingWithConsigner, allListings: ListingWithConsigner[]) {
  const activeOnVariant = allListings.filter(
    (l) => l.variant_id === listing.variant_id && l.status === "ACTIVE"
  );
  if (activeOnVariant.length === 0) return null;

  const lowestPayout = Math.min(...activeOnVariant.map((l) => l.payout));
  const count = activeOnVariant.length;
  const isLowest = listing.payout === lowestPayout;
  const undercutBy = isLowest ? 0 : listing.payout - lowestPayout;

  return { count, lowestPayout, isLowest, undercutBy };
}

export default function ListingsSection({ initialListings }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingWithConsigner[]>(initialListings);
  const [overrideTarget, setOverrideTarget] = useState<ListingWithConsigner | null>(null);
  const [markSoldTarget, setMarkSoldTarget] = useState<ListingWithConsigner | null>(null);
  const [orderName, setOrderName] = useState("");
  const [markSoldLoading, setMarkSoldLoading] = useState(false);
  const [markSoldError, setMarkSoldError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "lowest" | "undercut">("all");
  const [page, setPage] = useState(1);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);

  function handleOverrideSuccess(listingId: number, newPrice: number) {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId ? { ...l, sale_price_override: newPrice } : l
      )
    );
    setOverrideTarget(null);
    setSuccessMsg(`Verkoopprijs bijgewerkt naar ${euro(newPrice)} ✓`);
    setTimeout(() => setSuccessMsg(null), 4000);
    router.refresh();
  }

  async function submitMarkSold() {
    if (!markSoldTarget || !orderName.trim()) return;
    setMarkSoldLoading(true);
    setMarkSoldError(null);
    try {
      const res = await fetch(`/api/admin/listings/${markSoldTarget.id}/mark-sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderName: orderName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMarkSoldError(data.error || "Markeren als verkocht mislukt.");
      } else {
        const soldOrderName = orderName.trim();
        setListings((prev) =>
          prev.map((l) =>
            l.id === markSoldTarget.id
              ? { ...l, status: "SOLD", order_name: soldOrderName }
              : l
          )
        );
        setMarkSoldTarget(null);
        setOrderName("");
        setSuccessMsg(`Listing gemarkeerd als verkocht (${soldOrderName}) ✓`);
        setTimeout(() => setSuccessMsg(null), 4000);
        router.refresh();
      }
    } catch {
      setMarkSoldError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setMarkSoldLoading(false);
    }
  }

  // Bulk selection helpers
  const activeListingIds = listings
    .filter((l) => l.status === "ACTIVE")
    .map((l) => l.id);
  const selectedArray = Array.from(selectedIds);
  const allActiveSelected =
    activeListingIds.length > 0 &&
    activeListingIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(activeListingIds));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function handleBulkDelist() {
    if (selectedArray.length === 0) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je ${selectedArray.length} listing(s) wilt delisten?`
    );
    if (!confirmed) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/listings/bulk/delist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: selectedArray }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuccessMsg(`Fout: ${data.error || "Bulk delist mislukt."}`);
      } else {
        setListings((prev) =>
          prev.map((l) =>
            selectedIds.has(l.id) ? { ...l, status: "DELISTED" } : l
          )
        );
        setSelectedIds(new Set());
        setSuccessMsg(
          `${data.delistedCount} listing(s) gedelisted ✓${data.errors ? ` (${data.errors.length} fout(en))` : ""}`
        );
        setTimeout(() => setSuccessMsg(null), 5000);
        router.refresh();
      }
    } catch {
      setSuccessMsg("Netwerkfout bij bulk delist. Probeer opnieuw.");
    } finally {
      setBulkLoading(false);
    }
  }

  function handleBulkPriceSuccess(updated: number) {
    setShowBulkPriceModal(false);
    setSelectedIds(new Set());
    setSuccessMsg(`${updated} listing(s) bijgewerkt ✓`);
    setTimeout(() => setSuccessMsg(null), 5000);
    router.refresh();
  }

  const filtered = listings.filter((l) => {
    if (filter === "lowest") {
      const lowestOnVariant = Math.min(
        ...listings
          .filter((x) => x.variant_id === l.variant_id && x.status === "ACTIVE")
          .map((x) => x.payout)
      );
      return l.payout === lowestOnVariant;
    }
    if (filter === "undercut") {
      const lowestOnVariant = Math.min(
        ...listings
          .filter((x) => x.variant_id === l.variant_id && x.status === "ACTIVE")
          .map((x) => x.payout)
      );
      return l.payout > lowestOnVariant;
    }
    return true;
  });

  const itemsPerPage = 50;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const paginatedListings = filtered.slice(start, start + itemsPerPage);

  return (
    <>
      <h2 className="section-title">Alle listings</h2>

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

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as "all" | "lowest" | "undercut");
            setPage(1);
          }}
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--fg)",
            padding: "6px 10px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <option value="all">Alle</option>
          <option value="lowest">Alleen laagste</option>
          <option value="undercut">Alleen ondercut</option>
        </select>
      </div>

      <BulkListingsToolbar
        totalCount={activeListingIds.length}
        selectedCount={selectedIds.size}
        allSelected={allActiveSelected}
        onSelectAll={handleSelectAll}
        onBulkDelist={handleBulkDelist}
        onBulkPriceEdit={() => setShowBulkPriceModal(true)}
        loading={bulkLoading}
      />

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">Geen listings gevonden.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Product</th>
                <th>SKU</th>
                <th>Maat</th>
                <th>Consigner</th>
                <th>Payout</th>
                <th>Verkoop</th>
                <th>Verkoopprijs</th>
                <th>Marge</th>
                <th>Status</th>
                <th>Lowest ask</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedListings.map((l) => (
                <tr key={l.id} style={selectedIds.has(l.id) ? { background: "rgba(59,130,246,0.06)" } : undefined}>
                  <td style={{ textAlign: "center" }}>
                    {l.status === "ACTIVE" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(l.id)}
                        onChange={() => toggleSelect(l.id)}
                        style={{ width: 15, height: 15, cursor: "pointer" }}
                      />
                    )}
                  </td>
                  <td>
                    <div className="prod">
                      {l.product_image && <img src={l.product_image} alt="" />}
                      <span className="t">{l.product_title}</span>
                    </div>
                  </td>
                  <td><span className="sku">{l.sku}</span></td>
                  <td><span className="size-chip">{l.size}</span></td>
                  <td>{l.consigner_name}</td>
                  <td className="num">{euro(l.payout)}</td>
                  <td className="num">{euro(l.sale_price)}</td>
                  <td className="num">
                    {l.sale_price_override != null ? (
                      <span
                        style={{
                          color: "var(--green)",
                          fontWeight: 700,
                        }}
                        title="Prijs override actief"
                      >
                        {euro(l.sale_price_override)}{" "}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            background: "rgba(111,212,154,0.15)",
                            color: "var(--green)",
                            padding: "1px 5px",
                            borderRadius: 4,
                            verticalAlign: "middle",
                          }}
                        >
                          override
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td className="num">{euro(l.sale_price - l.payout)}</td>
                  <td>
                    <span className={`status ${l.status}`}>
                      {l.status === "ACTIVE"
                        ? "Live"
                        : l.status === "SOLD"
                        ? "Verkocht"
                        : "Offline"}
                    </span>
                  </td>
                  <td>
                    {l.status === "ACTIVE" && (() => {
                      const info = getLowestAskInfo(l, listings);
                      if (!info) return <span style={{ color: "var(--muted)" }}>—</span>;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {info.count} actief
                          </span>
                          {info.isLowest ? (
                            <span
                              style={{
                                background: "rgba(111,212,154,0.15)",
                                color: "var(--green)",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Laagste
                            </span>
                          ) : (
                            <span style={{ color: "#f97316", fontSize: 11, fontWeight: 600 }}>
                              ↓ Ondercut €{info.undercutBy}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {l.status === "ACTIVE" && (
                        <>
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => setOverrideTarget(l)}
                            style={{
                              background: "rgba(59,130,246,0.15)",
                              color: "#60a5fa",
                            }}
                          >
                            Pas prijs aan
                          </button>
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => {
                              setMarkSoldTarget(l);
                              setOrderName("");
                              setMarkSoldError(null);
                            }}
                            style={{
                              background: "rgba(111,212,154,0.15)",
                              color: "var(--green)",
                            }}
                          >
                            Mark Sold
                          </button>
                          <form
                            action={`/api/listings/${l.id}/delist`}
                            method="post"
                          >
                            <button className="btn danger sm" type="submit">
                              Delist
                            </button>
                          </form>
                        </>
                      )}
                      {l.status === "SOLD" && l.order_name && (
                        <span className="size-chip">{l.order_name}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 16,
            fontSize: 13,
          }}
        >
          <button
            className="btn sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </button>
          <span style={{ color: "var(--muted)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {overrideTarget && (
        <PriceOverrideModal
          listingId={overrideTarget.id}
          currentPrice={
            overrideTarget.sale_price_override ?? overrideTarget.sale_price
          }
          onClose={() => setOverrideTarget(null)}
          onSuccess={(newPrice) => handleOverrideSuccess(overrideTarget.id, newPrice)}
        />
      )}

      {markSoldTarget && (
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
            if (e.target === e.currentTarget) {
              setMarkSoldTarget(null);
            }
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 420 }}>
            <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
              Markeer als verkocht
            </h2>
            <p className="page-sub" style={{ marginBottom: 20 }}>
              Listing #{markSoldTarget.id} —{" "}
              <strong>{markSoldTarget.product_title}</strong>
              {markSoldTarget.size && (
                <> &middot; maat <strong>{markSoldTarget.size}</strong></>
              )}
            </p>

            {markSoldError && (
              <div className="error" style={{ marginBottom: 12 }}>
                {markSoldError}
              </div>
            )}

            <div className="field">
              <label htmlFor="order-name">Ordernaam</label>
              <input
                id="order-name"
                type="text"
                placeholder="bijv. #12345"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitMarkSold();
                }}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                className="btn"
                type="button"
                disabled={markSoldLoading || !orderName.trim()}
                onClick={submitMarkSold}
                style={{ flex: 1, background: "var(--green)", color: "#000" }}
              >
                {markSoldLoading ? "Bezig…" : "Mark Sold"}
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={markSoldLoading}
                onClick={() => setMarkSoldTarget(null)}
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkPriceModal && selectedArray.length > 0 && (
        <BulkPriceEditModal
          listingIds={selectedArray}
          onClose={() => setShowBulkPriceModal(false)}
          onSuccess={handleBulkPriceSuccess}
        />
      )}
    </>
  );
}
