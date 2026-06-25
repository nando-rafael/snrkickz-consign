"use client";

import { useState, useEffect } from "react";
import type { Listing } from "@/lib/db";
import { euro } from "@/lib/config";

type ListingGroup = {
  key: string;
  sku: string;
  size: string;
  payout: number;
  salePrice: number;
  productTitle: string | null;
  productImage: string | null;
  total: number;
  active: number;
  sold: number;
  listings: Listing[];
};

type Props = {
  initialGroups: ListingGroup[];
  totalListings: number;
};

function groupListings(listings: Listing[]): ListingGroup[] {
  const map = new Map<string, ListingGroup>();
  for (const l of listings) {
    const key = `${l.sku}__${l.size}__${l.payout}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        sku: l.sku,
        size: l.size,
        payout: l.payout,
        salePrice: l.sale_price,
        productTitle: l.product_title,
        productImage: l.product_image,
        total: 0,
        active: 0,
        sold: 0,
        listings: [],
      });
    }
    const g = map.get(key)!;
    g.total++;
    if (l.status === "ACTIVE") g.active++;
    else if (l.status === "SOLD") g.sold++;
    g.listings.push(l);
  }
  return Array.from(map.values());
}

export default function ListingsTable({ initialGroups, totalListings }: Props) {
  const [groups, setGroups] = useState<ListingGroup[]>(initialGroups);
  const [page, setPage] = useState(1);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(groups.length / itemsPerPage));
  const start = (page - 1) * itemsPerPage;
  const paginatedGroups = groups.slice(start, start + itemsPerPage);

  // Auto-refresh listings every 5 seconds to catch new listings
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/dashboard/listings");
        if (res.ok) {
          const data = await res.json();
          const newGroups = groupListings(data.listings);
          setGroups(newGroups);
        }
      } catch (e) {
        console.error("Failed to refresh listings:", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Ensure current page stays in bounds when group count changes
  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(groups.length / itemsPerPage));
    if (page > newTotalPages) {
      setPage(newTotalPages);
    }
  }, [groups.length, itemsPerPage, page]);

  if (groups.length === 0) {
    return (
      <div className="empty">
        No listings yet. Add your first pair via &quot;New Listing&quot;.
      </div>
    );
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Size</th>
            <th>Payout</th>
            <th>Sale Price</th>
            <th>Qty</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        {paginatedGroups.map((g) => (
          <tbody key={g.key}>
            {/* Group summary row */}
            <tr>
              <td>
                <div className="prod">
                  {g.productImage && <img src={g.productImage} alt="" />}
                  <span className="t">{g.productTitle}</span>
                </div>
              </td>
              <td>
                <span className="sku">{g.sku}</span>
              </td>
              <td>
                <span className="size-chip">EU {g.size}</span>
              </td>
              <td className="num">{euro(g.payout)}</td>
              <td className="num">{euro(g.salePrice)}</td>
              <td className="num" style={{ fontWeight: 600 }}>
                {g.total}x
              </td>
              <td>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {[
                    g.active > 0 && `${g.active} LIVE`,
                    g.sold > 0 && `${g.sold} SOLD`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </td>
              <td />
            </tr>
            {/* Individual listing rows */}
            {g.listings.map((l) => (
              <tr
                key={l.id}
                style={{ background: "var(--panel-2)", fontSize: 12 }}
              >
                <td
                  colSpan={5}
                  style={{ paddingLeft: 32, color: "var(--muted)" }}
                >
                  #{l.id} — listed {l.created_at.slice(0, 10)}
                  {l.order_name && ` · ${l.order_name}`}
                </td>
                <td />
                <td>
                  <span className={`status ${l.status}`}>
                    {l.status === "ACTIVE"
                      ? "Live"
                      : l.status === "SOLD"
                      ? "Sold"
                      : "Offline"}
                  </span>
                </td>
                <td>
                  {l.status === "ACTIVE" && (
                    <form action={`/api/listings/${l.id}/delist`} method="post">
                      <button className="btn danger sm" type="submit">
                        Delist
                      </button>
                    </form>
                  )}
                  {l.status === "SOLD" && l.shipping_label_url && (
                    <a
                      href={`/api/labels/${l.shipping_label_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn sm"
                      style={{
                        background: "rgba(96,165,250,0.15)",
                        color: "#60a5fa",
                      }}
                    >
                      Shipping Label ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

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
            Page {page} of {totalPages} ({groups.length} groups)
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
    </>
  );
}
