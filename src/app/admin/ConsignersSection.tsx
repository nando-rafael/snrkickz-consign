"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Consigner } from "@/lib/db";
import { euro } from "@/lib/config";

type ConsignerWithStats = Consigner & {
  activeCount: number;
  soldCount: number;
  pendingPayout: number;
};

type Props = {
  initialConsigners: ConsignerWithStats[];
};

export default function ConsignersSection({ initialConsigners }: Props) {
  const router = useRouter();
  const [consigners, setConsigners] = useState<ConsignerWithStats[]>(initialConsigners);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDelete(id: number, name: string) {
    if (
      !window.confirm(
        `⚠️ Weet je zeker dat je het account van "${name}" wilt verwijderen?\n\n` +
        `Dit verwijdert ook alle bijbehorende listings en kan niet ongedaan gemaakt worden.`
      )
    ) {
      return;
    }

    setLoadingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/consigners/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Verwijderen mislukt.");
      } else {
        setConsigners((prev) => prev.filter((c) => c.id !== id));
        setSuccessMsg(`✓ Account verwijderd - ${data.message}`);
        setTimeout(() => setSuccessMsg(null), 5000);
        router.refresh();
      }
    } catch {
      setErrorMsg("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoadingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return consigners;

    const query = searchQuery.toLowerCase();
    return consigners.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    );
  }, [consigners, searchQuery]);

  return (
    <>
      <h2 className="section-title">Consigners ({filtered.length})</h2>

      {successMsg && (
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
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="error" style={{ marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Zoeken op naam of email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--card)",
            color: "var(--fg)",
            fontSize: 13,
          }}
        />
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            {searchQuery
              ? "Geen consigners gevonden."
              : "Geen consigners gevonden."}
          </div>
        ) : (
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
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <span className="size-chip">{c.email}</span>
                  </td>
                  <td>
                    <span className="size-chip">{c.iban || "—"}</span>
                  </td>
                  <td>
                    <span className="size-chip">
                      {c.discord_username || "—"}
                    </span>
                  </td>
                  <td>
                    {c.discord_webhook_url ? (
                      <span
                        className="size-chip"
                        title={c.discord_webhook_url}
                      >
                        ✓ ingesteld
                      </span>
                    ) : (
                      <span className="size-chip">—</span>
                    )}
                  </td>
                  <td className="num">{c.activeCount}</td>
                  <td className="num">{c.soldCount}</td>
                  <td className="num">
                    {c.pendingPayout > 0 ? euro(c.pendingPayout) : "—"}
                  </td>
                  <td>
                    <button
                      className="btn danger sm"
                      type="button"
                      disabled={loadingId === c.id}
                      onClick={() => handleDelete(c.id, c.name)}
                      title="Account verwijderen"
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
