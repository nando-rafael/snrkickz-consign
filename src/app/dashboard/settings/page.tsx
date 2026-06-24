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
        <h1 className="page-title">Settings</h1>
        
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
          <h2 style={{ marginBottom: 16 }}>Discord Notifications</h2>
          <p style={{ marginBottom: 16, color: "#666" }}>
            Receive a Discord message when one of your items sells.
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
                Paste the webhook URL from your Discord channel here.
                <a href="https://support.discord.com/hc/en-us/articles/228383668-Webhooks-Guide" target="_blank" rel="noopener noreferrer">
                  {" "}How do I create a webhook?
                </a>
              </p>
            </div>
            <button className="btn" type="submit">
              Save
            </button>
          </form>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Profile</h2>
          <div style={{ marginBottom: 16 }}>
            <p><strong>Name:</strong> {consigner.name}</p>
            <p><strong>Email:</strong> {consigner.email}</p>
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
            Back to Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}

