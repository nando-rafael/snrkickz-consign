// 72u-deadline reminders richting Ymere.
//
// Klok start bij het opslaan van een concept (created_at) en stopt zodra de
// medewerker op "Exporteer naar Excel" klikt (exported_at) -- dat is het
// enige moment in de tool dat overeenkomt met "klaar om aan te leveren".
//
// Schema:
//   48u  -> mail naar de medewerker: nog 24u te gaan
//   66u  -> mail naar de medewerker: nog 6u te gaan
//   72u+ -> mail naar de medewerker EN de eigenaar (OWNER_EMAIL): te laat
//
// Verstuurd via een gewoon Gmail-account (App Password), net als bij de
// Snrkickz-meldingen -- werkt naar elk mailadres (Outlook, Gmail, etc.),
// e-mail is providerloos. Zonder GMAIL_USER/GMAIL_APP_PASSWORD wordt er
// alleen een waarschuwing gelogd, zodat de server niet crasht als dit nog
// niet is ingesteld.
const nodemailer = require('nodemailer');
const pool = require('./db/pool');
const { reminderEmailHtml, LOGO_ATTACHMENT, berekenTotaal } = require('./emailTemplate');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';

const UUR_MS = 60 * 60 * 1000;

let transporter = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

function adresLabel(data) {
  const adres = data && data.header && data.header.werkadres;
  return adres && adres.trim() ? adres.trim() : 'een opname zonder ingevuld adres';
}

async function sendMail(to, subject, html) {
  if (!to) return;
  if (!transporter) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD ontbreekt -- reminder niet verstuurd:', subject, '->', to);
    return;
  }
  try {
    await transporter.sendMail({
      from: `Opname → Offerte <${GMAIL_USER}>`,
      to,
      subject,
      html,
      attachments: [LOGO_ATTACHMENT],
    });
  } catch (err) {
    console.error('Versturen reminder-mail mislukt:', err.message);
  }
}

async function checkReminders() {
  let rows;
  try {
    const result = await pool.query(
      `SELECT o.id, o.data, o.concept_started_at,
              o.reminder_48_sent, o.reminder_66_sent, o.reminder_overdue_sent,
              u.email, u.naam
       FROM offertes o
       JOIN users u ON u.id = o.created_by
       WHERE o.exported_at IS NULL
         AND o.concept_started_at IS NOT NULL
         AND o.reminder_overdue_sent IS NOT TRUE`
    );
    rows = result.rows;
  } catch (err) {
    console.error('Kon offertes voor reminders niet ophalen:', err.message);
    return;
  }

  const now = Date.now();
  for (const row of rows) {
    const ageH = (now - new Date(row.concept_started_at).getTime()) / UUR_MS;
    const adres = adresLabel(row.data);
    const referentie = (row.data && row.data.header && row.data.header.referentie) || '';
    const totaal = berekenTotaal(row.data);

    if (ageH >= 72) {
      await sendMail(
        row.email,
        `Deadline verstreken: ${adres}`,
        reminderEmailHtml({
          kleur: '#C4432B',
          titel: 'Deadline verstreken',
          naam: row.naam,
          adres,
          referentie,
          totaal,
          boodschap:
            'De 72-uurstermijn voor deze offerte is verstreken en deze is nog niet geëxporteerd naar Excel. Lever deze zo snel mogelijk aan bij Ymere.',
        })
      );
      if (OWNER_EMAIL) {
        await sendMail(
          OWNER_EMAIL,
          `Te laat -- ${row.naam}: ${adres}`,
          reminderEmailHtml({
            kleur: '#C4432B',
            titel: 'Te laat',
            naam: 'Nando',
            adres,
            referentie,
            totaal,
            boodschap: `De offerte van <strong>${row.naam}</strong> is over de 72u-deadline heen en nog steeds niet geëxporteerd.`,
          })
        );
      }
      await pool.query('UPDATE offertes SET reminder_overdue_sent = true WHERE id = $1', [row.id]);
    } else if (ageH >= 66 && !row.reminder_66_sent) {
      await sendMail(
        row.email,
        `Nog 6 uur: ${adres}`,
        reminderEmailHtml({
          kleur: '#D4573F',
          titel: 'Nog 6 uur',
          naam: row.naam,
          adres,
          referentie,
          totaal,
          boodschap: 'Je hebt nog ongeveer <strong>6 uur</strong> om deze offerte te exporteren en aan te leveren bij Ymere.',
        })
      );
      await pool.query('UPDATE offertes SET reminder_66_sent = true WHERE id = $1', [row.id]);
    } else if (ageH >= 48 && !row.reminder_48_sent) {
      await sendMail(
        row.email,
        `Nog 24 uur: ${adres}`,
        reminderEmailHtml({
          kleur: '#D9A441',
          titel: 'Nog 24 uur',
          naam: row.naam,
          adres,
          referentie,
          totaal,
          boodschap: 'Je hebt nog <strong>24 uur</strong> tot het aanleveren van deze offerte aan Ymere.',
        })
      );
      await pool.query('UPDATE offertes SET reminder_48_sent = true WHERE id = $1', [row.id]);
    }
  }
}

// Handmatige check-in naar één specifieke medewerker, los van het
// automatische 48/66/72u-schema -- raakt de reminder_*_sent-vlaggen niet
// aan, dus het automatische schema loopt gewoon door zoals gepland.
async function sendManualCheckin(offerteId, afzenderNaam) {
  const result = await pool.query(
    `SELECT o.data, u.email, u.naam
     FROM offertes o
     JOIN users u ON u.id = o.created_by
     WHERE o.id = $1`,
    [offerteId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('Offerte niet gevonden.');
  const adres = adresLabel(row.data);
  const referentie = (row.data && row.data.header && row.data.header.referentie) || '';
  const totaal = berekenTotaal(row.data);
  await sendMail(
    row.email,
    `Check-in: ${adres}`,
    reminderEmailHtml({
      kleur: '#142E53',
      titel: 'Check-in',
      naam: row.naam,
      adres,
      referentie,
      totaal,
      boodschap: `${afzenderNaam || 'Nando'} vraagt hoe het gaat met deze offerte -- even een seintje wanneer die eraan komt.`,
    })
  );
  return { to: row.email, naam: row.naam, adres };
}

// Handmatige check-in naar een medewerker (los van een specifieke offerte),
// bv. vanuit de Medewerkers-tab. Pakt automatisch de langst openstaande
// offerte van die medewerker erbij als context; heeft iemand niks
// openstaand, dan gaat er een simpele check-in zonder offerte-details.
async function sendManualCheckinToUser(userId, afzenderNaam) {
  const userResult = await pool.query('SELECT email, naam FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  if (!user) throw new Error('Medewerker niet gevonden.');

  const offerteResult = await pool.query(
    `SELECT data FROM offertes
     WHERE created_by = $1 AND exported_at IS NULL
     ORDER BY concept_started_at ASC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  const offerteRow = offerteResult.rows[0];

  if (offerteRow) {
    const adres = adresLabel(offerteRow.data);
    const referentie = (offerteRow.data && offerteRow.data.header && offerteRow.data.header.referentie) || '';
    const totaal = berekenTotaal(offerteRow.data);
    await sendMail(
      user.email,
      `Check-in: ${adres}`,
      reminderEmailHtml({
        kleur: '#142E53',
        titel: 'Check-in',
        naam: user.naam,
        adres,
        referentie,
        totaal,
        boodschap: `${afzenderNaam || 'Nando'} vraagt hoe het gaat met je openstaande offerte -- even een seintje wanneer die eraan komt.`,
      })
    );
  } else {
    await sendMail(
      user.email,
      'Check-in',
      reminderEmailHtml({
        kleur: '#142E53',
        titel: 'Check-in',
        naam: user.naam,
        adres: null,
        referentie: '',
        totaal: 0,
        boodschap: `${afzenderNaam || 'Nando'} vraagt hoe het gaat -- laat even weten als er iets is.`,
      })
    );
  }
  return { to: user.email, naam: user.naam };
}

async function sendTestMail(to) {
  await sendMail(
    to,
    'Test -- Opname → Offerte reminders',
    reminderEmailHtml({
      kleur: '#D9A441',
      titel: 'Testmail',
      naam: 'Nando',
      adres: 'Voorbeeldstraat 12, Amsterdam',
      referentie: 'TEST-001',
      totaal: 311.37,
      boodschap:
        'Dit is een testmail. Als je dit ontvangt met logo en opmaak, staan <code>GMAIL_USER</code> en <code>GMAIL_APP_PASSWORD</code> goed ingesteld.',
    })
  );
}

module.exports = { checkReminders, sendTestMail, sendManualCheckin, sendManualCheckinToUser };
