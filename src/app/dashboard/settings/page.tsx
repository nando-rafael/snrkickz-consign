import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { consignersTable } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const consigner = consignersTable.findById(session.id);
  if (!consigner) redirect("/login");

  return (
    <main className="page container">
      <div className="card">
        <h1 className="page-title">Instellingen</h1>
        
        {searchParams.success && (
          <div className="success" style={{ marginBottom: 24 }}>
            {decodeURIComponent(searchParams.success)}
          </div>
        )}
        {searchParams.error && (
          <div className="error" style={{ marginBottom: 24 }}>
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Discord Notificaties</h2>
          <p style={{ marginBottom: 16, color: "#666" }}>
            Ontvang een Discord bericht wanneer een van je items verkoopt.
          </p>
          
          <form action="/api/settings/discord" method="post">
            <div className="field">
              <label htmlFor="discord_webhook_url">Discord Webhook URL</label>
              <input
                id="discord_webhook_url"
                name="discord_webhook_url"
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                defaultValue={consigner.discord_webhook_url || ""}
                className="mono"
              />
              <p className="hint">
                Plak hier de webhook URL van je Discord channel. 
                <a href="https://support.discord.com/hc/en-us/articles/228383668-Webhooks-Guide" target="_blank" rel="noopener noreferrer">
                  {" "}Hoe maak ik een webhook?
                </a>
              </p>
            </div>
            <button className="btn" type="submit">
              Opslaan
            </button>
          </form>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Profiel</h2>
          <div style={{ marginBottom: 16 }}>
            <p><strong>Naam:</strong> {consigner.name}</p>
            <p><strong>E-mail:</strong> {consigner.email}</p>
            {consigner.discord_username && (
              <p><strong>Discord:</strong> {consigner.discord_username}</p>
            )}
            {consigner.iban && (
              <p><strong>IBAN:</strong> {consigner.iban}</p>
            )}
          </div>
        </div>

        <div>
          <a href="/dashboard" className="btn">
            Terug naar dashboard
          </a>
        </div>
      </div>
    </main>
  );
}

