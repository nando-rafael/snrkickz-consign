import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="page container">
      <div className="card narrow">
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Registreren
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Maak een consigner account aan
        </p>
        {searchParams.error && (
          <div className="error">{decodeURIComponent(searchParams.error)}</div>
        )}
        <form action="/api/auth/register" method="post">
          <div className="field">
            <label htmlFor="name">Naam</label>
            <input id="name" name="name" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Wachtwoord</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="hint">Minimaal 8 tekens</p>
          </div>
          <div className="field">
            <label htmlFor="discord_username">Discord gebruikersnaam</label>
            <input 
              id="discord_username" 
              name="discord_username" 
              type="text" 
              placeholder="bijv. nando_rafael"
            />
            <p className="hint">Voor verkoopnotificaties in Discord</p>
          </div>
          <div className="field">
            <label htmlFor="iban">IBAN (voor uitbetalingen)</label>
            <input id="iban" name="iban" type="text" className="mono" placeholder="NL00 BANK 0000 0000 00" />
          </div>
          <button className="btn full" type="submit">
            Account aanmaken
          </button>
        </form>
        <p className="auth-foot">
          Al een account? <a href="/login">Inloggen</a>
        </p>
      </div>
    </main>
  );
}

