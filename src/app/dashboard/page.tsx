import { redirect } from "next/navigation";
import { listingsTable, payoutsTable, productRequestsTable, Listing } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { euro } from "@/lib/config";
import ListingsTable from "./ListingsTable";

export const dynamic = "force-dynamic";

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

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const listings = listingsTable.listByConsigner(session.id);
  const payouts = payoutsTable.listByConsigner(session.id);
  const productRequests = productRequestsTable.listByConsigner(session.id);

  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");
  const pendingSum = payouts.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  const paidSum = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  const nonDelisted = listings.filter((l) => l.status !== "DELISTED");
  const groups = groupListings(nonDelisted);

  return (
    <main className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hey {session.name.split(" ")[0]}</h1>
          <p className="page-sub">Your consignment overview</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard/settings" className="btn">⚙️ Settings</a>
          <a href="/listings/new" className="btn">+ New Listing</a>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Live Listings</div><div className="value">{active.length}</div></div>
        <div className="stat"><div className="label">Sold</div><div className="value">{sold.length}</div></div>
        <div className="stat"><div className="label">Pending Payout</div><div className="value">{euro(pendingSum)}</div></div>
        <div className="stat"><div className="label">Paid Out</div><div className="value">{euro(paidSum)}</div></div>
      </div>

      <h2 className="section-title">Listings</h2>
      <div className="table-wrap">
        <ListingsTable initialGroups={groups} totalListings={nonDelisted.length} />
      </div>

      <h2 className="section-title">Payouts</h2>
      <div className="table-wrap">
        {payouts.length === 0 ? (
          <div className="empty">Your payouts will appear here once a listing sells.</div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Order</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.created_at.slice(0, 10)}</td>
                  <td><span className="size-chip">{p.order_name}</span></td>
                  <td className="num">{euro(p.amount)}</td>
                  <td><span className={`status ${p.status}`}>{p.status === "PENDING" ? "Pending" : "Paid"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">My Product Requests</h2>
      <div className="table-wrap">
        {productRequests.length === 0 ? (
          <div className="empty">You haven't submitted any product requests yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {productRequests.map((r) => (
                <tr key={r.id}>
                  <td><span className="sku">{r.sku}</span></td>
                  <td>{r.product_name}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        background:
                          r.status === "PENDING" ? "rgba(160,160,160,0.15)" :
                          r.status === "APPROVED" ? "rgba(59,130,246,0.15)" :
                          r.status === "LIVE" ? "rgba(111,212,154,0.15)" :
                          "rgba(224,112,112,0.15)",
                        color:
                          r.status === "PENDING" ? "var(--muted)" :
                          r.status === "APPROVED" ? "#60a5fa" :
                          r.status === "LIVE" ? "var(--green)" :
                          "#e87070",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{r.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
