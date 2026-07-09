"use client";

import { useState, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return initialConsigners;

    const query = searchQuery.toLowerCase();
    return initialConsigners.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    );
  }, [initialConsigners, searchQuery]);

  return (
    <>
      <h2 className="section-title">Consigners ({filtered.length})</h2>

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
