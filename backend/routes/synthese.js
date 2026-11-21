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
  urlPublique, couleurPoint, dessinerAnneau, tableauSimple, bufferQr,
  protegerTexte, enTete, piedsDePage, place, blocSignature
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

    const doc = protegerTexte(new PDFDocument({ margin: 40, size: 'A4', bufferPages: true }));
    doc.pipe(res);
    const emise = req.utilisateur
      ? `Émise par ${req.utilisateur.nom} (${req.utilisateur.role}) · ${formaterParis(s.genereLe)}`
      : `Générée le ${formaterParis(s.genereLe)}`;
    enTete(doc, 'Fiche de synthèse — contrôle qualité', emise);

    dessinerAnneau(doc, 75, 150, 100, String(s.totalLots), 'lots enregistrés', SAGE);
    dessinerAnneau(doc, 205, 150, s.pourcentageValides, `${s.pourcentageValides} %`, 'validés par un biologiste', SAGE);
    dessinerAnneau(doc, 335, 150, s.pourcentageAnonymises, `${s.pourcentageAnonymises} %`, 'pseudonymisés', SAGE);
    const pctSig = s.totalLots ? Math.round(100 * s.signalementsEnCours / s.totalLots) : 0;
    dessinerAnneau(doc, 465, 150, pctSig, String(s.signalementsEnCours), 'signalements ouverts', '#C85A4A');

    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('1. Les lots', 40, 212);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('Note de confiance /100 : machine (15) + date (15) + conditions (15) + pseudonymisation (20) + aucun signalement ouvert (20) + validation de moins de 12 mois (15).', 40, 228, { width: 515 });
    const lots = [...s.lots].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true }));
    let y = tableauSimple(doc, [
      { label: 'Lot', w: 2.2 },
      { label: 'Machine', w: 2.2 },
      { label: 'Date de mesure', w: 1.5 },
      { label: 'Statut', w: 1.7 },
      { label: 'Note /100', w: 1 }
    ], lots.map((lot) => ({
      cellules: [
        lot.nom,
        lot.machine_nom || 'non renseignée',
        formaterJour(lot.date),
        { point: couleurPoint(lot.statut_affiche), texte: lot.statut_libelle },
        String(lot.score_confiance)
      ]
    })), 252, { hauteur: 19 });

    y = place(doc, y + 16, 60);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`2. Signalements ouverts (${signalements.length})`, 40, y);
    y += 18;
    if (!signalements.length) {
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Aucun signalement ouvert.', 40, y);
      y += 16;
    } else {
      y = tableauSimple(doc, [
        { label: 'Lot', w: 1.6 },
        { label: 'Motif', w: 6 }
      ], signalements.map((sig) => ({ cellules: [sig.lot_nom, sig.raison] })), y);
    }

    blocSignature(doc, y, qr, 'Scannez pour ouvrir le site');
    piedsDePage(doc, 'Fiche de synthèse biologIA · aucune donnée nominative');
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
