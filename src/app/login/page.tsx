import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
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
          Inloggen
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Consignment portal van Snrkickz
        </p>
        {searchParams.error && (
          <div className="error">{decodeURIComponent(searchParams.error)}</div>
        )}
        <form action="/api/auth/login" method="post">
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
              autoComplete="current-password"
            />
          </div>
          <button className="btn full" type="submit">
            Inloggen
          </button>
        </form>
        <p className="auth-foot">
          Nog geen account? <a href="/register">Registreren</a>
        </p>
      </div>
    </main>
  );
}
