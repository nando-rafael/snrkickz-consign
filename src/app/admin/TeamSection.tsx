"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Consigner } from "@/lib/db";

type Props = {
  initialManagers: Consigner[];
};

export default function TeamSection({ initialManagers }: Props) {
  const router = useRouter();
  const [managers, setManagers] = useState<Consigner[]>(initialManagers);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError("Alle velden zijn verplicht.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Aanmaken mislukt.");
        return;
      }

      setManagers((prev) => [data.manager, ...prev]);
      setSuccess(`✓ Order Manager aangemaakt`);
      setFormData({ name: "", email: "", password: "" });
      setShowModal(false);
      setTimeout(() => setSuccess(null), 4000);
      router.refresh();
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Order Manager "${name}" verwijderen?`)) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verwijderen mislukt.");
        return;
      }

      setManagers((prev) => prev.filter((m) => m.id !== id));
      setSuccess(`✓ Order Manager verwijderd`);
      setTimeout(() => setSuccess(null), 4000);
      router.refresh();
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("nl-NL");
  }

  return (
    <>
      <h2 className="section-title">Team Management</h2>

      {success && (
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
          {success}
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          className="btn"
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            background: "var(--accent)",
            color: "white",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          + Nieuwe Order Manager
        </button>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>
              Nieuwe Order Manager
            </h3>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>
                  Naam
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg)",
                    color: "var(--fg)",
                    fontSize: 13,
                  }}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg)",
                    color: "var(--fg)",
                    fontSize: 13,
                  }}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>
                  Wachtwoord
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg)",
                    color: "var(--fg)",
                    fontSize: 13,
                  }}
                  placeholder="••••••••"
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Aanmaken…" : "Aanmaken"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    background: "var(--border)",
                    color: "var(--fg)",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {managers.length === 0 ? (
          <div className="empty">Geen Order Managers.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>Email</th>
                <th>Aangemaakt</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>
                    <span className="size-chip">{m.email}</span>
                  </td>
                  <td>
                    <span className="size-chip">{formatDate(m.created_at)}</span>
                  </td>
                  <td>
                    <button
                      className="btn danger sm"
                      type="button"
                      disabled={deletingId === m.id}
                      onClick={() => handleDelete(m.id, m.name)}
                      title="Verwijderen"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

