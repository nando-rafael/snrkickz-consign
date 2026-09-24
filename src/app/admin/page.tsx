import { redirect } from "next/navigation";
import { listingsTable, payoutsTable, consignersTable, inventoryTable, productRequestsTable } from "@/lib/db";
import { getSession, isAdmin, isAdminOrOrderManager } from "@/lib/auth";
import { euro, feePct } from "@/lib/config";
import InventorySection from "./InventorySection";
import ProductRequestsSection from "./ProductRequestsSection";
import ListingsSection from "./ListingsSection";
import SalesSection from "./SalesSection";
import ConsignersSection from "./ConsignersSection";
import BroadcastOrdersSection from "./BroadcastOrdersSection";
import BroadcastChannelsSection from "./BroadcastChannelsSection";
import TeamSection from "./TeamSection";

export const dynamic = "force-dynamic";

type TabKey =
  | "overzicht"
  | "verkopen"
  | "listings"
  | "uitbetalingen"
  | "consigners"
  | "requests"
  | "inventory"
  | "broadcast"
  | "team";

type TabDef = { key: TabKey; label: string; badge?: number };
type CardDef = { key: TabKey; label: string; value: string };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminOrOrderManager(session.role)) redirect("/dashboard");

  const isAdminUser = isAdmin(session.role);
  const allListings = listingsTable.listAll();
  const allConsigners = consignersTable.listAll();

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

  const soldListings = sold.sort((a, b) => {
    if (!a.sold_at || !b.sold_at) return 0;
    return b.sold_at.localeCompare(a.sold_at);
  });

  const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
  const pendingSum = pendingPayouts.reduce((s, p) => s + p.amount, 0);
  const feeEarned = sold.reduce((s, l) => s + (l.sale_price - l.payout), 0);

  const consigners = allConsigners.map((c) => {
    const cListings = allListings.filter((l) => l.consigner_id === c.id);
    const activeCount = cListings.filter((l) => l.status === "ACTIVE").length;
    const soldCount = cListings.filter((l) => l.status === "SOLD").length;
    const pendingPayout = payouts
      .filter((p) => p.consigner_id === c.id && p.status === "PENDING")
      .reduce((s, p) => s + p.amount, 0);
    return { ...c, activeCount, soldCount, pendingPayout };
  });

  const ordermanagers = consigners.filter((c) => c.role === "ORDERMANAGER");

  const openRequests = allProductRequests.filter((r) => {
    const s = String((r as any).status || "").toUpperCase();
    return s !== "LIVE" && s !== "REJECTED" && s !== "AFGEWEZEN";
  }).length;

  const tabs: TabDef[] = [{ key: "overzicht", label: "Overzicht" }, { key: "verkopen", label: "Verkopen" }];

  if (isAdminUser) {
    tabs.push({ key: "listings", label: "Listings" });
    tabs.push({ key: "uitbetalingen", label: "Uitbetalingen", badge: pendingPayouts.length });
  }

  tabs.push({ key: "consigners", label: "Consigners" });
  tabs.push({ key: "requests", label: "Requests", badge: openRequests });

  if (isAdminUser) {
    tabs.push({ key: "inventory", label: "Inventory" });
    tabs.push({ key: "broadcast", label: "Broadcast" });
    tabs.push({ key: "team", label: "Team" });
  }

  const requested = (searchParams?.tab || "overzicht") as TabKey;
  const tab: TabKey = tabs.some((t) => t.key === requested) ? requested : "overzicht";

  const overviewCards: CardDef[] = [{ key: "verkopen", label: "Verkopen", value: String(sold.length) }];

  if (isAdminUser) {
    overviewCards.push({ key: "listings", label: "Live listings", value: String(active.length) });
    overviewCards.push({ key: "uitbetalingen", label: "Openstaande uitbetalingen", value: String(pendingPayouts.length) });
  }

  overviewCards.push({ key: "requests", label: "Open requests", value: String(openRequests) });
  overviewCards.push({ key: "consigners", label: "Consigners", value: String(consigners.length) });

  if (isAdminUser) {
    overviewCards.push({ key: "inventory", label: "Inventory", value: String(inventory.length) });
  }

  return (
    <main className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isAdminUser ? "Admin" : "Order Manager"}</h1>
          <p className="page-sub">Fee: {feePct()}% over de verkoopprijs · laagste ask wint</p>
        </div>
      </div>

      {isAdminUser && (
        <div className="stats">
          <div className="stat">
            <div className="label">Live listings</div>
            <div className="value">{active.length}</div>
          </div>
          <div className="stat">
            <div className="label">Verkocht</div>
            <div className="value">{sold.length}</div>
          </div>
          <div className="stat">
            <div className="label">Fee verdiend</div>
            <div className="value">{euro(feeEarned)}</div>
          </div>
          <div className="stat">
            <div className="label">Uit te betalen</div>
            <div className="value">{euro(pendingSum)}</div>
          </div>
        </div>
      )}

      <nav
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid #262622",
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => (
          
            key={t.key}
            href={`/admin?tab=${t.key}`}
            style={{
              padding: "10px 15px",
              fontSize: 13.5,
              whiteSpace: "nowrap",
              textDecoration: "none",
              color: t.key === tab ? "#f2f0ea" : "#8f8b80",
              borderBottom: t.key === tab ? "2px solid #ff5f1f" : "2px solid transparent",
              marginBottom: -1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span
                style={{
                  background: "#ff5f1f",
                  color: "#0c0c0b",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 999,
                  lineHeight: 1.5,
                }}
              >
                {t.badge}
              </span>
            )}
          </a>
        ))}
      </nav>

      {tab === "overzicht" && (
        <div>
          <h2 className="section-title">Snel naar</h2>
          <div className="stats">
            {overviewCards.map((c) => (
              
                key={c.key}
                href={`/admin?tab=${c.key}`}
                className="stat"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div className="label">{c.label}</div>
                <div className="value">{c.value}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {tab === "verkopen" && <SalesSection initialListings={soldListings} hideMargin={!isAdminUser} />}

      {tab === "listings" && isAdminUser && <ListingsSection initialListings={active} />}

      {tab === "uitbetalingen" && isAdminUser && (
        <div>
          <h2 className="section-title">Openstaande uitbetalingen ({pendingPayouts.length})</h2>
          <div className="table-wrap">
            {pendingPayouts.length === 0 ? (
              <div className="empty">Geen openstaande uitbetalingen.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Consigner</th>
                    <th>IBAN</th>
                    <th>Item</th>
                    <th>Order</th>
                    <th>Bedrag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayouts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.created_at.slice(0, 10)}</td>
                      <td>
                        {p.consigner_name}
                        <div className="size-chip">{p.consigner_email}</div>
                      </td>
                      <td>
                        <span className="size-chip">{p.iban || "—"}</span>
                      </td>
                      <td>
                        <span className="sku">{p.sku}</span>
                      </td>
                      <td>
                        <span className="size-chip">{p.order_name}</span>
                      </td>
                      <td className="num">{euro(p.amount)}</td>
                      <td>
                        <form action={`/api/admin/payouts/${p.id}/paid`} method="post">
                          <button className="btn sm" type="submit">
                            Markeer uitbetaald
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "consigners" && <ConsignersSection initialConsigners={consigners} hideMargin={!isAdminUser} />}

      {tab === "requests" && <ProductRequestsSection initialRequests={allProductRequests} hideMargin={!isAdminUser} />}

      {tab === "inventory" && isAdminUser && <InventorySection initialItems={inventory} />}

      {tab === "broadcast" && isAdminUser && (
        <div>
          <BroadcastChannelsSection />
          <BroadcastOrdersSection />
        </div>
      )}

      {tab === "team" && isAdminUser && <TeamSection initialManagers={ordermanagers} />}
    </main>
  );
}
