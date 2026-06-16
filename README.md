# Snrkickz Consign

Consignment portal voor Snrkickz. Consigners registreren, voegen hun paren toe
op stylecode + maat, en de voorraad wordt direct gesynchroniseerd naar het
bestaande product in Shopify. Bij verkoop wordt de listing automatisch op
"Verkocht" gezet en staat de payout klaar.

## Hoe het werkt

1. **Consigner registreert** (naam, e-mail, wachtwoord, IBAN)
2. **Listing toevoegen**: consigner zoekt op stylecode (bijv. `KH7719`) —
   het systeem haalt het product met de **echte maten** uit de store op
   (in de Snrkickz catalogus delen alle maten dezelfde SKU; de maat staat in
   de variant-titel, incl. breukmaten zoals "38 2/3")
   - Consigner kiest een maat en vult zijn payout in
   - Voorraad van die variant gaat **+1** op de Snrkickz locatie
   - Verkoopprijs = `payout / (1 - fee%)`, afgerond naar hele euro's
   - **Prijsbescherming**: de verkoopprijs kan nooit boven de huidige
     storeprijs uitkomen (max payout wordt per maat getoond). Is de
     consignment-prijs lager, dan wordt de storeprijs verlaagd (laagste ask
     wint). Na verkoop of delist wordt de **originele storeprijs automatisch
     hersteld** zodra er geen actieve listings meer zijn op die maat
3. **Verkoop**: Shopify stuurt de order via webhook → listing wordt gematcht
   op **variant-ID** (waterdicht, ook bij gedeelde SKU's) → laagste payout
   eerst → status "Verkocht" → payout staat als "In behandeling" in de admin
4. **Admin** ziet alle listings, marges, en openstaande uitbetalingen (met IBAN), en markeert payouts als uitbetaald **na ontvangst/levering van het item**

## Setup

### 1. Shopify app (nieuwe Dev Dashboard)

Maak de app aan in de Shopify Dev Dashboard met scopes:
`read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_orders`

Zet de distributie op **Custom distribution** voor jouw store en installeer de
app via de install-link. Sinds 2026 toont Shopify geen Admin API token meer in
de UI — kopieer in plaats daarvan de **Client ID** en **Client Secret**
(Settings → Credentials) naar `.env`. De app wisselt die zelf automatisch in
voor een access token (client credentials grant) en ververst die ook zelf.

Heb je nog een oude custom app met een `shpat_` token? Zet die dan in
`SHOPIFY_ADMIN_TOKEN` — dan worden Client ID/Secret genegeerd.

### 2. Webhook

Shopify admin → **Settings → Notifications → Webhooks → Create webhook**

- Event: **Order creation**
- Format: JSON
- URL: `https://JOUW-DOMEIN/api/webhooks/orders`
- API versie: 2025-01

Kopieer de **signing secret** die onderaan de webhooks-pagina staat.

### 3. Environment

```bash
cp .env.example .env
# vul alle waardes in
```

`ADMIN_EMAILS` = jouw e-mailadres. Registreer daarna een account met datzelfde
adres → dat account ziet de Admin pagina.

### 4. Draaien

```bash
npm install
npm run build
npm start        # draait op poort 3001
```

Lokaal ontwikkelen: `npm run dev`

### 5. Hosting

SQLite heeft een **persistent disk** nodig. Werkt op: een VPS (Hetzner ~€5/mnd),
Railway, Render of Fly.io met volume. **Niet** op Vercel/Netlify serverless
(daar verdwijnt het databasebestand). Zet er een reverse proxy met HTTPS voor
(Caddy is 2 regels config) — de webhook URL moet publiek bereikbaar zijn over
HTTPS.

## Spelregels (operationeel, niet in code)

- **Payout pas na levering.** Markeer een payout pas als uitbetaald wanneer het
  item bij de klant is (of door jou gecheckt). Dit is je bescherming tegen
  no-ships en fakes.
- **Eigen voorraad + consignment op dezelfde maat**: de webhook telt een
  verkoop altijd eerst als consignment-verkoop als er een actieve listing op
  die variant staat. Heb je zelf óók een paar in die maat, hou daar rekening
  mee.
- **Exclusiviteit**: spreek met consigners af dat een gelist paar niet ook op
  Vinted/Marktplaats staat, anders krijg je oversells.

## Beperkingen MVP (bewust simpel gehouden)

- Geen e-mailnotificaties (consigner ziet status in dashboard; check als admin
  dagelijks de openstaande payouts)
- Geen QC/approval stap — listings gaan direct live
- 1 paar per listing (meerdere paren = meerdere listings)
- Refunds/cancellations worden niet automatisch teruggedraaid — zet de listing
  in dat geval handmatig terug via een nieuwe listing
