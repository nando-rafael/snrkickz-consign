"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Inventory } from "@/lib/db";

type Props = {
  initialItems: Inventory[];
};

type ToListingState = {
  itemId: number;
  payout: string;
  salePrice: string;
};

export default function InventorySection({ initialItems }: Props) {
  const router = useRouter();

  // ── Item list (optimistic local state) ──────────────────────
  const [items, setItems] = useState<Inventory[]>(initialItems);

  // ── Pagination ───────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Add form ─────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSku, setAddSku] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // ── Upload-to-listing modal ───────────────────────────────────
  const [toListing, setToListing] = useState<ToListingState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────
  async function handleAdd() {
    setAddError(null);
    const qty = parseInt(addQty, 10);
    if (!addSku.trim()) return setAddError("SKU is verplicht.");
    if (!addTitle.trim()) return setAddError("Productnaam is verplicht.");
    if (!addSize.trim()) return setAddError("Maat is verplicht.");
    if (isNaN(qty) || qty < 1) return setAddError("Vul een geldige hoeveelheid in.");

    setAddLoading(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: addSku.trim().toUpperCase(),
          product_title: addTitle.trim(),
          size: addSize.trim(),
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Toevoegen mislukt.");
      } else {
        // Refresh server data
        router.refresh();
        // Optimistically add to local list
        setItems((prev) => [
          {
            id: data.id,
            sku: addSku.trim().toUpperCase(),
            product_title: addTitle.trim(),
            size: addSize.trim(),
            quantity: qty,
            created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
          },
          ...prev,
        ]);
        setAddSku("");
        setAddTitle("");
        setAddSize("");
        setAddQty("1");
        setShowAddForm(false);
      }
    } catch {
      setAddError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch("/api/inventory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    }
  }

  async function handleUpload() {
    if (!toListing) return;
    setUploadError(null);
    const payout = parseFloat(toListing.payout);
    if (!payout || payout <= 0) {
      setUploadError("Vul een geldige payout in.");
      return;
    }

    setUploadLoading(true);
    try {
      const body: Record<string, unknown> = { payout };
      if (toListing.salePrice) {
        const sp = parseFloat(toListing.salePrice);
        if (!isNaN(sp) && sp > 0) body.sale_price = sp;
      }

      const res = await fetch(`/api/inventory/${toListing.itemId}/to-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Conversie mislukt.");
      } else {
        // Decrement or remove from local list
        setItems((prev) =>
          prev
            .map((i) =>
              i.id === toListing.itemId
                ? { ...i, quantity: i.quantity - 1 }
                : i
            )
            .filter((i) => i.quantity > 0)
        );
        setToListing(null);
        router.refresh();
      }
    } catch {
      setUploadError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setUploadLoading(false);
    }
  }

  // ── Pagination derived values ────────────────────────────────
  const itemsPerPage = 50;
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const paginatedItems = items.slice(start, start + itemsPerPage);

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "32px 0 12px" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Mijn Inventory ({items.length})
        </h2>
        <button
          className="btn sm ghost"
          type="button"
          onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
        >
          {showAddForm ? "Annuleer" : "+ Item toevoegen"}
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          {addError && <div className="error">{addError}</div>}
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="inv-sku">SKU</label>
              <input
                id="inv-sku"
                className="mono"
                placeholder="KH7719"
                value={addSku}
                onChange={(e) => setAddSku(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="inv-size">Maat</label>
              <input
                id="inv-size"
                placeholder="42"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
              />
            </div>
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="inv-title">Productnaam</label>
              <input
                id="inv-title"
                placeholder="Nike Air Max 1"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="inv-qty">Aantal</label>
              <input
                id="inv-qty"
                type="number"
                min="1"
                step="1"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </div>
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={handleAdd}
            disabled={addLoading}
          >
            {addLoading ? "Toevoegen…" : "Toevoegen"}
          </button>
        </div>
      )}

      <div className="table-wrap">
        {items.length === 0 ? (
          <div className="empty">Geen inventory items.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Maat</th>
                <th>Quantity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_title}</td>
                  <td><span className="sku">{item.sku}</span></td>
                  <td><span className="size-chip">{item.size}</span></td>
                  <td className="num">{item.quantity}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn sm"
                        type="button"
                        onClick={() => {
                          setToListing({ itemId: item.id, payout: "", salePrice: "" });
                          setUploadError(null);
                        }}
                      >
                        Upload to Consignment
                      </button>
                      <button
                        className="btn danger sm"
                        type="button"
                        onClick={() => handleDelete(item.id)}
                      >
                        Delete
                      </button>
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

      {/* Upload-to-listing modal */}
      {toListing && (() => {
        const item = items.find((i) => i.id === toListing.itemId);
        return (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 50,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setToListing(null); }}
          >
            <div className="card" style={{ width: "100%", maxWidth: 420 }}>
              <h2 className="page-title" style={{ fontSize: 17, marginBottom: 4 }}>
                Upload to Consignment
              </h2>
              {item && (
                <p className="page-sub" style={{ marginBottom: 20 }}>
                  <span className="sku">{item.sku}</span>&nbsp; {item.product_title} · Maat {item.size}
                </p>
              )}

              {uploadError && <div className="error">{uploadError}</div>}

              <div className="field">
                <label htmlFor="ul-payout">Payout (€)</label>
                <input
                  id="ul-payout"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="170"
                  value={toListing.payout}
                  onChange={(e) =>
                    setToListing((s) => s && { ...s, payout: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="ul-sale">Verkoopprijs (€) — optioneel</label>
                <input
                  id="ul-sale"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Automatisch berekend"
                  value={toListing.salePrice}
                  onChange={(e) =>
                    setToListing((s) => s && { ...s, salePrice: e.target.value })
                  }
                />
                <p className="hint">Laat leeg om de verkoopprijs automatisch te berekenen op basis van de payout en het fee-percentage.</p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn"
                  type="button"
                  onClick={handleUpload}
                  disabled={uploadLoading}
                  style={{ flex: 1 }}
                >
                  {uploadLoading ? "Bezig…" : "Maak listing aan"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setToListing(null)}
                >
                  Annuleer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
