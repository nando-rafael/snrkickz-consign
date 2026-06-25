"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/db";
import PriceOverrideModal from "./PriceOverrideModal";

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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "lowest" | "undercut">("all");
  const [page, setPage] = useState(1);

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

      <div style={{ marginBottom: 12 }}>
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

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">Geen listings gevonden.</div>
        ) : (
          <table>
            <thead>
              <tr>
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
                <tr key={l.id}>
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
    </>
  );
}
