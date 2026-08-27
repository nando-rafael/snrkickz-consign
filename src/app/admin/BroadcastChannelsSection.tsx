"use client";

import { useState, useEffect } from "react";

type BroadcastChannel = {
  id: number;
  brand: string;
  match_type: "VENDOR" | "TAG" | "TITLE_CONTAINS";
  match_value: string;
  discord_webhook_url: string;
  supplier_email: string;
  default_payout_percentage: number;
  active: boolean;
  created_at: string;
};

export default function BroadcastChannelsSection() {
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    brand: "",
    match_type: "VENDOR" as const,
    match_value: "",
    discord_webhook_url: "",
    supplier_email: "",
    default_payout_percentage: 40,
  });

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      const res = await fetch("/api/admin/broadcast-channels");
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (e) {
      console.error("Failed to fetch channels:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      // Update
      const res = await fetch(`/api/admin/broadcast-channels/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditId(null);
        setShowForm(false);
        setForm({
          brand: "",
          match_type: "VENDOR",
          match_value: "",
          discord_webhook_url: "",
          supplier_email: "",
          default_payout_percentage: 40,
        });
        await fetchChannels();
      }
    } else {
      // Create
      const res = await fetch("/api/admin/broadcast-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({
          brand: "",
          match_type: "VENDOR",
          match_value: "",
          discord_webhook_url: "",
          supplier_email: "",
          default_payout_percentage: 40,
        });
        await fetchChannels();
      }
    }
  }

  function handleEdit(ch: BroadcastChannel) {
    setEditId(ch.id);
    setForm({
      brand: ch.brand,
      match_type: ch.match_type,
      match_value: ch.match_value,
      discord_webhook_url: ch.discord_webhook_url,
      supplier_email: ch.supplier_email,
      default_payout_percentage: ch.default_payout_percentage,
    });
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Verwijder deze channel?")) return;
    const res = await fetch(`/api/admin/broadcast-channels/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchChannels();
    }
  }

  async function toggleActive(id: number, active: boolean) {
    const res = await fetch(`/api/admin/broadcast-channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) {
      await fetchChannels();
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <section>
      <h2 className="section-title">Broadcast Channels ({channels.length})</h2>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "Edit Channel" : "Nieuwe Channel"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Brand</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="bijv. Asics"
                  required
                />
              </div>

              <div className="form-group">
                <label>Match Type</label>
                <select
                  value={form.match_type}
                  onChange={(e) => setForm({ ...form, match_type: e.target.value as any })}
                >
                  <option value="VENDOR">Vendor</option>
                  <option value="TAG">Tag</option>
                  <option value="TITLE_CONTAINS">Titel bevat</option>
                </select>
              </div>

              <div className="form-group">
                <label>Match Value</label>
                <input
                  type="text"
                  value={form.match_value}
                  onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                  placeholder="bijv. Asics"
                  required
                />
              </div>

              <div className="form-group">
                <label>Discord Webhook URL</label>
                <input
                  type="url"
                  value={form.discord_webhook_url}
                  onChange={(e) => setForm({ ...form, discord_webhook_url: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Supplier Email</label>
                <input
                  type="email"
                  value={form.supplier_email}
                  onChange={(e) => setForm({ ...form, supplier_email: e.target.value })}
                  placeholder="supplier@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Default Payout % (0-100)</label>
                <input
                  type="number"
                  value={form.default_payout_percentage}
                  onChange={(e) => setForm({ ...form, default_payout_percentage: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn">
                  {editId ? "Opslaan" : "Aanmaken"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button className="btn" onClick={() => setShowForm(true)}>
        + Nieuwe Channel
      </button>

      <div className="table-wrap">
        {channels.length === 0 ? (
          <div className="empty">Geen broadcast channels ingesteld.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Match Type</th>
                <th>Supplier Email</th>
                <th>Payout %</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id}>
                  <td>{ch.brand}</td>
                  <td>{ch.match_type}</td>
                  <td>{ch.supplier_email}</td>
                  <td>{ch.default_payout_percentage}%</td>
                  <td>
                    <button
                      className={`btn sm ${ch.active ? "active" : "inactive"}`}
                      onClick={() => toggleActive(ch.id, ch.active)}
                    >
                      {ch.active ? "Actief" : "Inactief"}
                    </button>
                  </td>
                  <td className="actions">
                    <button className="btn sm" onClick={() => handleEdit(ch)}>
                      Edit
                    </button>
                    <button className="btn sm danger" onClick={() => handleDelete(ch.id)}>
                      Verwijder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

