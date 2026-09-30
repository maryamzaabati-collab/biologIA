const express = require('express');
const router = express.Router();
const db = require('../db');

async function chiffres() {
  const { total } = await db.get('SELECT COUNT(*) AS total FROM lots');
  const { valides } = await db.get('SELECT COUNT(DISTINCT lot_id) AS valides FROM validations');
  const { anonymises } = await db.get('SELECT COUNT(*) AS anonymises FROM lots WHERE anonymise = 1');
  const { enCours } = await db.get('SELECT COUNT(*) AS enCours FROM signalements WHERE resolu = 0');
  const { alertesIdentite } = await db.get('SELECT COUNT(*) AS alertesIdentite FROM lots WHERE alerte_identite = 1');
  const { douteux } = await db.get("SELECT COUNT(*) AS douteux FROM lots WHERE statut = 'douteux'");
  const { sansValidation } = await db.get(`
    SELECT COUNT(*) AS sansValidation FROM lots
    WHERE id NOT IN (SELECT DISTINCT lot_id FROM validations)
  `);

  return {
    totalLots: total,
    lotsValides: valides,
    lotsAnonymises: anonymises,
    signalementsEnCours: enCours,
    lotsAlerteIdentite: alertesIdentite,
    lotsDouteux: douteux,
    lotsSansValidation: sansValidation,
    pourcentageValides: total ? Math.round((valides / total) * 100) : 0,
    pourcentageAnonymises: total ? Math.round((anonymises / total) * 100) : 0,
    genereLe: new Date().toISOString()
  };
}

router.get('/', async (req, res) => {
  try {
    res.json(await chiffres());
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/csv', async (req, res) => {
  try {
    const s = await chiffres();
    const lignes = [
      ['indicateur', 'valeur'],
      ['lots_enregistres', s.totalLots],
      ['lots_valides', s.lotsValides],
      ['pourcentage_valides', s.pourcentageValides],
      ['lots_anonymises', s.lotsAnonymises],
      ['pourcentage_anonymises', s.pourcentageAnonymises],
      ['signalements_en_cours', s.signalementsEnCours],
      ['lots_alerte_identite', s.lotsAlerteIdentite],
      ['genere_le', s.genereLe]
    ];
    const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-synthese.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const s = await chiffres();
    const lots = await db.all(`
      SELECT lots.*, machines.nom AS machine_nom
      FROM lots LEFT JOIN machines ON lots.machine_id = machines.id
      ORDER BY lots.date_creation DESC
    `);

    const PDFDocument = require('pdfkit');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-synthese.pdf"');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Fiche de synthese — Controle qualite', { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#4C5850').text(`Registre de tracabilite — generee le ${new Date(s.genereLe).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    doc.moveDown(1);
    doc.fillColor('#16241E').fontSize(12);
    doc.text(`Lots enregistres : ${s.totalLots}`);
    doc.text(`Lots valides par un biologiste : ${s.lotsValides} (${s.pourcentageValides} %)`);
    doc.text(`Lots pseudonymises : ${s.lotsAnonymises} (${s.pourcentageAnonymises} %)`);
    doc.text(`Signalements en cours : ${s.signalementsEnCours}`);
    doc.text(`Lots avec colonnes identifiantes detectees : ${s.lotsAlerteIdentite}`);
    doc.moveDown(1);
    doc.fontSize(14).text('Lots');
    doc.moveDown(0.4);
    doc.fontSize(9);
    lots.forEach((lot) => {
      const statut = lot.statut === 'ok' ? 'Valide' : 'A verifier';
      doc.text(`L-${String(lot.id).padStart(3, '0')} — ${lot.nom} — ${lot.machine_nom || 'machine n/r'} — ${lot.date || 'date n/r'} — ${statut}`);
    });
    if (!lots.length) doc.text('Aucun lot enregistre.');

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
