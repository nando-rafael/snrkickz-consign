import { redirect } from "next/navigation";
import { listingsTable, payoutsTable, consignersTable, inventoryTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { euro, feePct } from "@/lib/config";
import InventorySection from "./InventorySection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.email)) redirect("/dashboard");

  const listings = listingsTable.listAll().map((l) => {
    const c = consignersTable.findById(l.consigner_id);
    return { ...l, consigner_name: c?.name ?? "?", consigner_email: c?.email ?? "?" };
  });

  const payouts = payoutsTable.listAll().map((p) => {
    const c = consignersTable.findById(p.consigner_id);
    const l = listingsTable.findById(p.listing_id);
    return {
      ...p,
      consigner_name: c?.name ?? "?",
      consigner_email: c?.email ?? "?",
      iban: c?.iban ?? null,
      sku: l?.sku ?? "?",
      product_title: l?.product_title ?? null,
    };
  });

  const inventory = inventoryTable.listAll();

  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");
  const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
  const pendingSum = pendingPayouts.reduce((s, p) => s + p.amount, 0);
  const feeEarned = sold.reduce((s, l) => s + (l.sale_price - l.payout), 0);

  return (
    <main className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-sub">Fee: {feePct()}% over de verkoopprijs · laagste ask wint</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><div className="label">Live listings</div><div className="value">{active.length}</div></div>
        <div className="stat"><div className="label">Verkocht</div><div className="value">{sold.length}</div></div>
        <div className="stat"><div className="label">Fee verdiend</div><div className="value">{euro(feeEarned)}</div></div>
        <div className="stat"><div className="label">Uit te betalen</div><div className="value">{euro(pendingSum)}</div></div>
      </div>

      <InventorySection initialItems={inventory} />

      <h2 className="section-title">Openstaande uitbetalingen ({pendingPayouts.length})</h2>
      <div className="table-wrap">
        {pendingPayouts.length === 0 ? <div className="empty">Geen openstaande uitbetalingen.</div> : (
          <table>
            <thead><tr><th>Datum</th><th>Consigner</th><th>IBAN</th><th>Item</th><th>Order</th><th>Bedrag</th><th></th></tr></thead>
            <tbody>
              {pendingPayouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.created_at.slice(0, 10)}</td>
                  <td>{p.consigner_name}<div className="size-chip">{p.consigner_email}</div></td>
                  <td><span className="size-chip">{p.iban || "—"}</span></td>
                  <td><span className="sku">{p.sku}</span></td>
                  <td><span className="size-chip">{p.order_name}</span></td>
                  <td className="num">{euro(p.amount)}</td>
                  <td>
                    <form action={`/api/admin/payouts/${p.id}/paid`} method="post">
                      <button className="btn sm" type="submit">Markeer uitbetaald</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">Alle listings</h2>
      <div className="table-wrap">
        {listings.length === 0 ? <div className="empty">Nog geen listings.</div> : (
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Maat</th><th>Consigner</th><th>Payout</th><th>Verkoop</th><th>Marge</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td><div className="prod">{l.product_image && <img src={l.product_image} alt="" />}<span className="t">{l.product_title}</span></div></td>
                  <td><span className="sku">{l.sku}</span></td>
                  <td><span className="size-chip">{l.size}</span></td>
                  <td>{l.consigner_name}</td>
                  <td className="num">{euro(l.payout)}</td>
                  <td className="num">{euro(l.sale_price)}</td>
                  <td className="num">{euro(l.sale_price - l.payout)}</td>
                  <td><span className={`status ${l.status}`}>{l.status === "ACTIVE" ? "Live" : l.status === "SOLD" ? "Verkocht" : "Offline"}</span></td>
                  <td>
                    {l.status === "ACTIVE" && (
                      <form action={`/api/listings/${l.id}/delist`} method="post">
                        <button className="btn danger sm" type="submit">Delist</button>
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
    </main>
  );
}
