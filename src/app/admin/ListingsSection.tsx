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

export default function ListingsSection({ initialListings }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingWithConsigner[]>(initialListings);
  const [overrideTarget, setOverrideTarget] = useState<ListingWithConsigner | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

      <div className="table-wrap">
        {listings.length === 0 ? (
          <div className="empty">Nog geen listings.</div>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
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
