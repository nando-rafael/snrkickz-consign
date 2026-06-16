import type { Metadata } from "next";
import "./globals.css";
import { getSession, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Snrkickz Consign",
  description: "Consignment portal voor Snrkickz",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const admin = isAdmin(session?.email);

  return (
    <html lang="nl">
      <body>
        <header className="site-header">
          <div className="container">
            <a href={session ? "/dashboard" : "/login"} className="wordmark">
              SNRKICKZ<span>/</span>CONSIGN
            </a>
            <nav className="nav">
              {session ? (
                <>
                  <a href="/dashboard">Mijn listings</a>
                  <a href="/listings/new">Nieuwe listing</a>
                  {admin && <a href="/admin">Admin</a>}
                  <form action="/api/auth/logout" method="post">
                    <button className="btn ghost sm" type="submit">
                      Uitloggen
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/login">Inloggen</a>
                  <a href="/register">Registreren</a>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
