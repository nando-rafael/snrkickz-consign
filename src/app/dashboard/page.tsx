import { redirect } from "next/navigation";
import { listingsTable, payoutsTable, productRequestsTable, type Listing } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { euro } from "@/lib/config";

export const dynamic = "force-dynamic";

type ListingGroup = {
  key: string;
  sku: string;
  size: string;
  payout: number;
  sale_price: number;
  product_title: string | null;
  product_image: string | null;
  listings: Listing[];
  liveCount: number;
  soldCount: number;
  delistedCount: number;
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
        sale_price: l.sale_price,
        product_title: l.product_title,
        product_image: l.product_image,
        listings: [],
        liveCount: 0,
        soldCount: 0,
        delistedCount: 0,
      });
    }
    const group = map.get(key)!;
    group.listings.push(l);
    if (l.status === "ACTIVE") group.liveCount++;
    else if (l.status === "SOLD") group.soldCount++;
    else group.delistedCount++;
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

  const listingGroups = groupListings(listings);

  return (
    <main className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hey {session.name.split(" ")[0]}</h1>
          <p className="page-sub">Jouw consignment overzicht</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard/settings" className="btn">⚙️ Instellingen</a>
          <a href="/listings/new" className="btn">+ Nieuwe listing</a>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Live listings</div><div className="value">{active.length}</div></div>
        <div className="stat"><div className="label">Verkocht</div><div className="value">{sold.length}</div></div>
        <div className="stat"><div className="label">Openstaande payout</div><div className="value">{euro(pendingSum)}</div></div>
        <div className="stat"><div className="label">Uitbetaald</div><div className="value">{euro(paidSum)}</div></div>
      </div>

      <h2 className="section-title">Listings</h2>
      <div className="table-wrap">
        {listings.length === 0 ? (
          <div className="empty">Nog geen listings. Voeg je eerste paar toe via "Nieuwe listing".</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Maat</th>
                <th>Payout</th>
                <th>Verkoopprijs</th>
                <th>Aantal</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listingGroups.map((g) => {
                const total = g.listings.length;
                const statusParts: string[] = [];
                if (g.liveCount > 0) statusParts.push(`${g.liveCount} LIVE`);
                if (g.soldCount > 0) statusParts.push(`${g.soldCount} SOLD`);
                if (g.delistedCount > 0) statusParts.push(`${g.delistedCount} OFFLINE`);
                const statusLabel = statusParts.join(", ");

                return (
                  <tr key={g.key}>
                    <td>
                      <div className="prod">
                        {g.product_image && <img src={g.product_image} alt="" />}
                        <span className="t">{g.product_title}</span>
                      </div>
                    </td>
                    <td><span className="sku">{g.sku}</span></td>
                    <td><span className="size-chip">EU {g.size}</span></td>
                    <td className="num">{euro(g.payout)}</td>
                    <td className="num">{euro(g.sale_price)}</td>
                    <td className="num" style={{ fontWeight: total > 1 ? 700 : 400 }}>
                      {total > 1 ? `${total}×` : "1"}
                    </td>
                    <td>
                      <span
                        style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {g.listings
                          .filter((l) => l.status === "ACTIVE")
                          .map((l) => (
                            <form key={l.id} action={`/api/listings/${l.id}/delist`} method="post">
                              <button className="btn danger sm" type="submit">
                                {total > 1 ? `#${l.id} verwijderen` : "Verwijderen"}
                              </button>
                            </form>
                          ))}
                        {g.listings
                          .filter((l) => l.status === "SOLD" && l.order_name)
                          .map((l) => (
                            <span key={l.id} className="size-chip">{l.order_name}</span>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">Uitbetalingen</h2>
      <div className="table-wrap">
        {payouts.length === 0 ? (
          <div className="empty">Zodra een listing verkoopt verschijnt je payout hier.</div>
        ) : (
          <table>
            <thead><tr><th>Datum</th><th>Order</th><th>Bedrag</th><th>Status</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.created_at.slice(0, 10)}</td>
                  <td><span className="size-chip">{p.order_name}</span></td>
                  <td className="num">{euro(p.amount)}</td>
                  <td><span className={`status ${p.status}`}>{p.status === "PENDING" ? "In behandeling" : "Uitbetaald"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">Mijn product requests</h2>
      <div className="table-wrap">
        {productRequests.length === 0 ? (
          <div className="empty">Je hebt nog geen product requests ingediend.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Productnaam</th>
                <th>Status</th>
                <th>Datum</th>
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
