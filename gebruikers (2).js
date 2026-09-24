// Medewerkersoverzicht: alleen voor de beheerder (zie requireAdmin). Toont
// wie een account heeft aangemaakt, met welk e-mailadres (belangrijk om te
// checken of reminder-mails ergens aankomen) en hoeveel offertes iemand
// heeft.
const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../auth');
const { sendTestMail, sendManualCheckin, sendManualCheckinToUser } = require('../reminders');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Handmatige testmail, zodat je niet 48/72u hoeft te wachten om te checken
// of GMAIL_USER/GMAIL_APP_PASSWORD goed staan ingesteld. Stuurt altijd naar
// het e-mailadres van de ingelogde (admin) gebruiker zelf.
router.post('/test-mail', async (req, res) => {
  try {
    await sendTestMail(req.user.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('Testmail versturen mislukt:', err);
    res.status(500).json({ error: 'Kon testmail niet versturen.' });
  }
});

// Alle nog niet-geëxporteerde offertes, over alle medewerkers heen -- dit is
// de "loopt de 72u-deadline nog goed"-lijst. Alleen de beheerder ziet dit
// (normale medewerkers zien alleen hun eigen offertes, zie routes/offertes.js).
// Handmatig, buiten het 48/66/72u-schema om: stuur nu direct een check-in
// naar de medewerker van deze specifieke offerte. Raakt de automatische
// reminder-vlaggen niet aan.
router.post('/offertes/:id/stuur-reminder', async (req, res) => {
  try {
    const info = await sendManualCheckin(req.params.id, req.user.naam);
    res.json({ ok: true, ...info });
  } catch (err) {
    console.error('Handmatige reminder versturen mislukt:', err);
    res.status(500).json({ error: err.message || 'Kon reminder niet versturen.' });
  }
});

router.get('/offertes-open', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.data, o.concept_started_at, o.exported_at,
              u.naam AS medewerker_naam
       FROM offertes o
       JOIN users u ON u.id = o.created_by
       WHERE o.exported_at IS NULL
         AND o.concept_started_at IS NOT NULL
       ORDER BY o.concept_started_at ASC`
    );
    const now = Date.now();
    res.json(
      result.rows.map((r) => {
        const ageH = (now - new Date(r.concept_started_at).getTime()) / (60 * 60 * 1000);
        let urgentie = 'ok';
        if (ageH >= 72) urgentie = 'te_laat';
        else if (ageH >= 66) urgentie = 'urgent';
        else if (ageH >= 48) urgentie = 'let_op';
        return {
          id: r.id,
          adres: (r.data && r.data.header && r.data.header.werkadres) || null,
          referentie: (r.data && r.data.header && r.data.header.referentie) || null,
          medewerkerNaam: r.medewerker_naam,
          conceptStartedAt: r.concept_started_at,
          urenBezig: Math.floor(ageH),
          urgentie,
        };
      })
    );
  } catch (err) {
    console.error('Ophalen openstaande offertes mislukt:', err);
    res.status(500).json({ error: 'Kon openstaande offertes niet ophalen.' });
  }
});

// Handmatige check-in per medewerker (Medewerkers-tab), los van een
// specifieke offerte. Pakt automatisch de langst openstaande offerte van die
// medewerker erbij; heeft iemand niks openstaand, dan is het een simpele
// check-in zonder offerte-details.
router.post('/:id/stuur-reminder', async (req, res) => {
  try {
    const info = await sendManualCheckinToUser(req.params.id, req.user.naam);
    res.json({ ok: true, ...info });
  } catch (err) {
    console.error('Handmatige reminder naar medewerker mislukt:', err);
    res.status(500).json({ error: err.message || 'Kon reminder niet versturen.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.naam, u.email, u.rol, u.created_at,
              COUNT(o.id) AS aantal_offertes,
              MAX(o.updated_at) AS laatste_activiteit
       FROM users u
       LEFT JOIN offertes o ON o.created_by = u.id
       GROUP BY u.id
       ORDER BY u.naam ASC`
    );
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        naam: r.naam,
        email: r.email,
        rol: r.rol,
        createdAt: r.created_at,
        aantalOffertes: Number(r.aantal_offertes),
        laatsteActiviteit: r.laatste_activiteit,
      }))
    );
  } catch (err) {
    console.error('Ophalen medewerkers mislukt:', err);
    res.status(500).json({ error: 'Kon medewerkers niet ophalen.' });
  }
});

module.exports = router;
