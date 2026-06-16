import { redirect } from "next/navigation";
import { listingsTable, payoutsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { euro } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const listings = listingsTable.listByConsigner(session.id);
  const payouts = payoutsTable.listByConsigner(session.id);

  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");
  const pendingSum = payouts.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  const paidSum = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  return (
    <main className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hey {session.name.split(" ")[0]}</h1>
          <p className="page-sub">Jouw consignment overzicht</p>
        </div>
        <a href="/listings/new" className="btn">+ Nieuwe listing</a>
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
            <thead><tr><th>Product</th><th>SKU</th><th>Maat</th><th>Payout</th><th>Verkoopprijs</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td><div className="prod">{l.product_image && <img src={l.product_image} alt="" />}<span className="t">{l.product_title}</span></div></td>
                  <td><span className="sku">{l.sku}</span></td>
                  <td><span className="size-chip">EU {l.size}</span></td>
                  <td className="num">{euro(l.payout)}</td>
                  <td className="num">{euro(l.sale_price)}</td>
                  <td><span className={`status ${l.status}`}>{l.status === "ACTIVE" ? "Live" : l.status === "SOLD" ? "Verkocht" : "Offline"}</span></td>
                  <td>
                    {l.status === "ACTIVE" && (
                      <form action={`/api/listings/${l.id}/delist`} method="post">
                        <button className="btn danger sm" type="submit">Verwijderen</button>
                      </form>
                    )}
                    {l.status === "SOLD" && l.order_name && <span className="size-chip">{l.order_name}</span>}
                  </td>
                </tr>
              ))}
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
    </main>
  );
}
