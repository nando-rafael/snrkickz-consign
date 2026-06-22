import { redirect } from "next/navigation";
import { listingsTable, payoutsTable, consignersTable, inventoryTable, productRequestsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { euro, feePct } from "@/lib/config";
import InventorySection from "./InventorySection";
import ProductRequestsSection from "./ProductRequestsSection";
import ListingsSection from "./ListingsSection";
import SalesSection from "./SalesSection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.email)) redirect("/dashboard");

  const allListings = listingsTable.listAll();

  const listings = allListings.map((l) => {
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

  const allProductRequests = productRequestsTable.listAll().map((r) => {
    const c = consignersTable.findById(r.consigner_id);
    return { ...r, consigner_name: c?.name ?? "?", consigner_email: c?.email ?? "?" };
  });

  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");
  const soldListings = sold;
  const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
  const pendingSum = pendingPayouts.reduce((s, p) => s + p.amount, 0);
  const feeEarned = sold.reduce((s, l) => s + (l.sale_price - l.payout), 0);

  const consigners = consignersTable.listAll().map((c) => {
    const cListings = allListings.filter((l) => l.consigner_id === c.id);
    const activeCount = cListings.filter((l) => l.status === "ACTIVE").length;
    const soldCount = cListings.filter((l) => l.status === "SOLD").length;
    const pendingPayout = payouts
      .filter((p) => p.consigner_id === c.id && p.status === "PENDING")
      .reduce((s, p) => s + p.amount, 0);
    return { ...c, activeCount, soldCount, pendingPayout };
  });

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

      <ProductRequestsSection initialRequests={allProductRequests} />

      <h2 className="section-title">Consigners ({consigners.length})</h2>
      <div className="table-wrap">
        {consigners.length === 0 ? <div className="empty">Geen consigners gevonden.</div> : (
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>Email</th>
                <th>IBAN</th>
                <th>Discord</th>
                <th>Webhook URL</th>
                <th>Live</th>
                <th>Verkocht</th>
                <th>Uitbetaling</th>
              </tr>
            </thead>
            <tbody>
              {consigners.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><span className="size-chip">{c.email}</span></td>
                  <td><span className="size-chip">{c.iban || "—"}</span></td>
                  <td><span className="size-chip">{c.discord_username || "—"}</span></td>
                  <td>
                    {c.discord_webhook_url
                      ? <span className="size-chip" title={c.discord_webhook_url}>✓ ingesteld</span>
                      : <span className="size-chip">—</span>}
                  </td>
                  <td className="num">{c.activeCount}</td>
                  <td className="num">{c.soldCount}</td>
                  <td className="num">{c.pendingPayout > 0 ? euro(c.pendingPayout) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

      <SalesSection initialListings={soldListings} />

      <ListingsSection initialListings={listings} />
    </main>
  );
}
