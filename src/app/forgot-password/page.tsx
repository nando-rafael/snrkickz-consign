"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Er ging iets mis");
      } else {
        setMessage(data.message);
        setSubmitted(true);
        setEmail("");
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page container">
      <div className="card narrow">
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Wachtwoord resetten
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Voer je e-mailadres in om je wachtwoord opnieuw in te stellen
        </p>

        {submitted && (
          <div
            style={{
              background: "rgba(111, 212, 154, 0.08)",
              border: "1px solid rgba(111, 212, 154, 0.35)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 20,
              color: "var(--green)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✓ {message}
          </div>
        )}

        {error && <div className="error" style={{ marginBottom: 20 }}>{error}</div>}

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <button className="btn full" type="submit" disabled={loading}>
              {loading ? "Bezig..." : "Reset link versturen"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: 12, color: "var(--muted)", fontSize: 13 }}>
              Controleer je inbox voor een e-mail met reset instructies.
              Vergeet niet je spam-folder te controleren.
            </p>
            <button
              className="btn ghost"
              onClick={() => setSubmitted(false)}
            >
              Ander e-mailadres proberen
            </button>
          </div>
        )}

        <p className="auth-foot">
          <a href="/login">Terug naar inloggen</a>
        </p>
      </div>
    </main>
  );
}
