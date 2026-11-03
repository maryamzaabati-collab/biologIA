const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db');
const { libelleStatut, csvAvecBom } = require('../lib/tracabilite');
const { formaterParis, formaterJour } = require('../lib/dates');
const { analyserTout } = require('../lib/coherence');

function uniqueValidations(liste) {
  const vus = new Set();
  return (liste || []).filter((v) => {
    if (vus.has(v.nom_biologiste)) return false;
    vus.add(v.nom_biologiste);
    return true;
  });
}

async function lotsEnrichis({ inclureTest = false } = {}) {
  const lots = await db.all(`
    SELECT lots.*, machines.nom AS machine_nom,
      (SELECT COUNT(*) FROM signalements WHERE lot_id = lots.id AND resolu = 0) AS nb_signalements
    FROM lots LEFT JOIN machines ON lots.machine_id = machines.id
    WHERE COALESCE(lots.archive, 0) = 0
    ORDER BY lots.date_creation DESC
  `);
  const enrichis = [];
  for (const lot of lots) {
    if (!inclureTest && Number(lot.est_test)) continue;
    const validations = uniqueValidations(await db.all(
      'SELECT * FROM validations WHERE lot_id = ? ORDER BY date_validation DESC',
      [lot.id]
    ));
    const vu = libelleStatut(lot, validations, Number(lot.nb_signalements) || 0);
    const { detailScoreConfiance } = require('../lib/tracabilite');
    const detail = detailScoreConfiance(lot, validations, Number(lot.nb_signalements) || 0);
    enrichis.push({
      ...lot,
      validations,
      statut_affiche: vu.code,
      statut_libelle: vu.libelle,
      score_confiance: detail.score
    });
  }
  return enrichis;
}

async function chiffres() {
  const lots = await lotsEnrichis();
  const total = lots.length;
  const parStatut = (code) => lots.filter((l) => l.statut_affiche === code).length;
  const valides = parStatut('valide');
  const anonymises = lots.filter((l) => Number(l.anonymise)).length;
  const enCours = lots.reduce((s, l) => s + (Number(l.nb_signalements) || 0), 0);
  const alertesIdentite = lots.filter((l) => Number(l.alerte_identite)).length;
  const machines = {};
  for (const lot of lots) {
    const nom = lot.machine_nom || 'non renseignée';
    if (!machines[nom]) machines[nom] = { nom, lots: 0, valides: 0 };
    machines[nom].lots += 1;
    if (lot.statut_affiche === 'valide') machines[nom].valides += 1;
  }
  const out = {
    totalLots: total,
    lotsValides: valides,
    lotsAnonymises: anonymises,
    signalementsEnCours: enCours,
    lotsAlerteIdentite: alertesIdentite,
    lotsDouteux: parStatut('signale'),
    lotsBrouillon: parStatut('brouillon'),
    lotsAValider: parStatut('a_valider'),
    lotsARevalider: parStatut('a_revalider'),
    lotsSansValidation: parStatut('a_valider') + parStatut('a_revalider'),
    pourcentageValides: total ? Math.round((valides / total) * 100) : 0,
    pourcentageAnonymises: total ? Math.round((anonymises / total) * 100) : 0,
    par_machine: Object.values(machines),
    lots,
    genereLe: new Date().toISOString(),
    score_qualite_moyen: null,
    nb_anomalies_coherence: 0
  };
  try {
    const coh = await analyserTout(db);
    const n = (coh.lots || []).length;
    out.score_qualite_moyen = n
      ? Math.round(coh.lots.reduce((s, l) => s + ((l.score_qualite && l.score_qualite.global) || 0), 0) / n)
      : null;
    out.nb_anomalies_coherence = (coh.anomalies || []).length;
  } catch { /* ignore */ }
  return out;
}

router.get('/', async (req, res) => {
  try {
    const s = await chiffres();
    const { lots, ...rest } = s;
    res.json({ ...rest, lots: lots.map((l) => ({
      id: l.id,
      nom: l.nom,
      machine_nom: l.machine_nom,
      date: l.date,
      statut_affiche: l.statut_affiche,
      statut_libelle: l.statut_libelle,
      score_confiance: l.score_confiance,
      nb_signalements: l.nb_signalements
    })) });
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
      ['lots_pseudonymises', s.lotsAnonymises],
      ['pourcentage_pseudonymises', s.pourcentageAnonymises],
      ['signalements_en_cours', s.signalementsEnCours],
      ['lots_alerte_identite', s.lotsAlerteIdentite],
      ['lots_brouillon', s.lotsBrouillon],
      ['lots_a_valider', s.lotsAValider],
      ['lots_a_revalider', s.lotsARevalider],
      ['lots_signales', s.lotsDouteux],
      ['genere_le', formaterParis(s.genereLe)]
    ];
    for (const m of s.par_machine) {
      lignes.push([`machine_${m.nom}_lots`, m.lots]);
      lignes.push([`machine_${m.nom}_valides`, m.valides]);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="synthese.csv"');
    res.send(csvAvecBom(lignes));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

const {
  SAGE, INK, MUTED,
  urlPublique, couleurPoint, dessinerAnneau, tableauSimple, bufferQr
} = require('../lib/pdf-maquettes');

router.get('/pdf', async (req, res) => {
  try {
    const s = await chiffres();
    const signalements = await db.all(`
      SELECT signalements.raison, lots.nom AS lot_nom
      FROM signalements JOIN lots ON lots.id = signalements.lot_id
      WHERE signalements.resolu = 0 AND COALESCE(lots.archive, 0) = 0 AND COALESCE(lots.est_test, 0) = 0
      ORDER BY signalements.date DESC
    `);
    const PDFDocument = require('pdfkit');
    const site = urlPublique(req);
    const qr = await bufferQr(site);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-synthese.pdf"');

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    doc.pipe(res);

    doc.roundedRect(40, 28, 22, 22, 5).fill(SAGE);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(SAGE).text('biologIA', 68, 33);
    doc.fontSize(9).fillColor(MUTED).text('Registre de traçabilité', 320, 32, { width: 230, align: 'right' });
    doc.fontSize(8).text('Données fictives · démonstrateur pédagogique', 320, 46, { width: 230, align: 'right' });
    doc.strokeColor(SAGE).lineWidth(1.2).moveTo(40, 68).lineTo(555, 68).stroke();

    doc.fontSize(16).fillColor(INK).font('Helvetica-Bold')
      .text('Fiche de synthèse — Contrôle qualité', 40, 80);
    const emise = req.utilisateur
      ? `Émise par ${req.utilisateur.nom} (${req.utilisateur.role}) · ${formaterParis(s.genereLe)}`
      : `Générée le ${formaterParis(s.genereLe)}`;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(emise, 40, 102);

    dessinerAnneau(doc, 70, 160, 100, String(s.totalLots), 'lots enregistrés', SAGE);
    dessinerAnneau(doc, 190, 160, s.pourcentageValides, `${s.pourcentageValides} %`, 'validés par un biologiste', SAGE);
    dessinerAnneau(doc, 310, 160, s.pourcentageAnonymises, `${s.pourcentageAnonymises} %`, 'pseudonymisés', SAGE);
    dessinerAnneau(doc, 430, 160, s.signalementsEnCours ? 70 : 8, String(s.signalementsEnCours), 'signalements ouverts', '#C85A4A');

    doc.y = 210;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Lots', 40, 210);
    const yLots = tableauSimple(doc, [
      { label: 'Lot', w: 2.4 },
      { label: 'Machine', w: 2.2 },
      { label: 'Date', w: 1.4 },
      { label: 'Statut', w: 1.6 },
      { label: 'Score', w: 0.8 }
    ], s.lots.map((lot) => ({
      cellules: [
        lot.nom,
        lot.machine_nom || 'n/r',
        formaterJour(lot.date),
        { point: couleurPoint(lot.statut_affiche), texte: lot.statut_libelle },
        String(lot.score_confiance)
      ]
    })), 228);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Signalements ouverts', 40, yLots + 10);
    let yFin = yLots + 28;
    if (!signalements.length) {
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Aucun signalement ouvert.', 40, yFin);
      yFin += 16;
    } else {
      yFin = tableauSimple(doc, [
        { label: 'Lot', w: 2 },
        { label: 'Motif', w: 5 }
      ], signalements.map((sig) => ({
        cellules: [sig.lot_nom, sig.raison]
      })), yFin);
    }

    const ySign = Math.min(yFin + 16, 700);
    doc.strokeColor(SAGE).lineWidth(0.8).rect(40, ySign, 280, 56).stroke();
    doc.fontSize(8).fillColor(MUTED).text('Signature du biologiste · nom, date, paraphe', 48, ySign + 8);

    if (qr) {
      try { doc.image(qr, 470, ySign, { width: 72 }); } catch { /* ignore */ }
    }

    const plage = doc.bufferedPageRange();
    for (let i = 0; i < plage.count; i++) {
      doc.switchToPage(plage.start + i);
      doc.fontSize(8).fillColor(MUTED).text(
        `biologIA · Page ${i + 1} / ${plage.count}`,
        40,
        792,
        { width: doc.page.width - 80, align: 'center', lineBreak: false }
      );
    }
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
