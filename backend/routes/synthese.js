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
    SELECT lots.*, machines.nom AS machine_nom, machines.type AS machine_type,
      (SELECT COUNT(*) FROM signalements WHERE lot_id = lots.id AND resolu = 0) AS nb_signalements,
      (SELECT raison FROM signalements WHERE lot_id = lots.id AND resolu = 0 ORDER BY date DESC LIMIT 1) AS dernier_signalement
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

// Fiche de synthèse sur UNE page A4 : un tableau de bord imprimable.
// Elle ne liste pas tous les lots (il y en a plus de 150) : elle résume, puis
// montre seulement ce qu'il faut traiter en priorité.
const NOMS_DISCIPLINES = {
  biochimie: 'Biochimie', hematologie: 'Hématologie', immunologie: 'Immunologie', gazometrie: 'Gaz du sang',
  microbiologie: 'Microbiologie', hemostase: 'Hémostase', urines: 'Urines', hemocultures: 'Hémocultures',
  electrophorese: 'Électrophorèse', biologie_moleculaire: 'Biologie moléculaire', centrifugeuse: 'Pré-analytique'
};
const COULEURS_STATUT = [
  ['valide', 'Validés', '#3F6F55'],
  ['a_valider', 'À valider', '#D4A04A'],
  ['a_revalider', 'À revalider', '#4A6FA5'],
  ['signale', 'Signalés', '#C85A4A'],
  ['brouillon', 'Brouillons', '#9A958A']
];

function actionPour(lot) {
  if (lot.statut_affiche === 'signale') return lot.dernier_signalement || 'Signalement à examiner';
  if (lot.statut_affiche === 'a_valider') return 'À faire valider par un biologiste';
  if (lot.statut_affiche === 'a_revalider') return 'Validation de plus de 12 mois : à renouveler';
  if (lot.statut_affiche === 'brouillon') {
    const manque = [!lot.machine_id && 'machine', !lot.date && 'date', !lot.conditions && 'conditions'].filter(Boolean);
    return manque.length ? `À compléter : ${manque.join(', ')}` : 'Brouillon à compléter';
  }
  return '';
}

// Arc de cercle (pour le graphique en anneau des statuts).
function arc(doc, cx, cy, r, debut, fin, couleur, epaisseur) {
  if (fin - debut <= 0.0001) return;
  const a0 = -Math.PI / 2 + debut * 2 * Math.PI;
  const a1 = -Math.PI / 2 + fin * 2 * Math.PI;
  const large = fin - debut > 0.5 ? 1 : 0;
  doc.path(`M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`)
    .lineWidth(epaisseur).lineCap('butt').strokeColor(couleur).stroke();
}

router.get('/pdf', async (req, res) => {
  try {
    const s = await chiffres();
    const lots = s.lots;
    const machines = await db.all('SELECT * FROM machines');
    const PDFDocument = require('pdfkit');
    const qr = await bufferQr(urlPublique(req) + '/synthese.html');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-synthese.pdf"');

    const doc = protegerTexte(new PDFDocument({ margin: 40, size: 'A4', bufferPages: true }));
    doc.pipe(res);
    const LIGNE = '#DDD6C8';
    const ROUGE = '#C85A4A';
    const emise = req.utilisateur
      ? `Émise par ${req.utilisateur.nom} (${req.utilisateur.role}) · ${formaterParis(s.genereLe)}`
      : `Générée le ${formaterParis(s.genereLe)}`;
    enTete(doc, 'Fiche de synthèse — Contrôle qualité', `${emise} · plateau technique de Nice`);

    const titre = (texte, x, y) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(texte, x, y, { lineBreak: false });
    };
    const noteMoy = lots.length ? Math.round(lots.reduce((t, l) => t + (Number(l.score_confiance) || 0), 0) / lots.length) : 0;
    const aTraiter = lots.filter((l) => l.statut_affiche !== 'valide').length;

    // 1. La phrase à retenir
    doc.font('Helvetica').fontSize(9).fillColor(INK)
      .text(`${s.totalLots} lots suivis sur ${machines.length} machines. `, 40, 120, { continued: true })
      .font('Helvetica-Bold').text(`${s.pourcentageValides} % sont validés et utilisables`, { continued: true })
      .font('Helvetica').text(` ; ${aTraiter} demandent une action (liste en bas de page).`);

    // 2. Les anneaux, comme sur le site
    const yA = 172;
    dessinerAnneau(doc, 82, yA, 100, String(s.totalLots), 'lots suivis', SAGE);
    dessinerAnneau(doc, 190, yA, s.pourcentageValides, `${s.pourcentageValides} %`, 'validés par un biologiste', SAGE);
    dessinerAnneau(doc, 298, yA, s.pourcentageAnonymises, `${s.pourcentageAnonymises} %`, 'pseudonymisés', SAGE);
    dessinerAnneau(doc, 406, yA, noteMoy, String(noteMoy), 'note de confiance moyenne', SAGE);
    const pctSig = s.totalLots ? Math.max(6, Math.round(100 * s.lotsDouteux / s.totalLots)) : 0;
    dessinerAnneau(doc, 514, yA, pctSig, String(s.signalementsEnCours), `signalements ouverts (${s.lotsDouteux} lots)`, ROUGE);

    // 3a. Où en sont les lots ? — anneau des statuts
    let y = 238;
    doc.moveTo(40, y - 8).lineTo(555, y - 8).lineWidth(0.5).strokeColor(LIGNE).stroke();
    titre('Où en sont les lots ?', 40, y);
    const comptes = COULEURS_STATUT.map(([code, lib, c]) => [lots.filter((l) => l.statut_affiche === code).length, lib, c]);
    const cx = 88;
    const cy = y + 66;
    let cumul = 0;
    for (const [n, , c] of comptes) {
      const part = n / Math.max(1, s.totalLots);
      arc(doc, cx, cy, 38, cumul, cumul + part, c, 13);
      cumul += part;
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(String(s.totalLots), cx - 30, cy - 9, { width: 60, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text('lots', cx - 30, cy + 7, { width: 60, align: 'center', lineBreak: false });
    let yl = y + 30;
    for (const [n, lib, c] of comptes) {
      doc.circle(152, yl + 4, 3.5).fill(c);
      doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(lib, 161, yl, { width: 80, lineBreak: false });
      doc.font('Helvetica-Bold').text(String(n), 238, yl, { width: 28, align: 'right', lineBreak: false });
      doc.font('Helvetica').fillColor(MUTED).text(`${Math.round(100 * n / Math.max(1, s.totalLots))} %`, 268, yl, { width: 30, align: 'right', lineBreak: false });
      yl += 15;
    }

    // 3b. Lots enregistrés sur 12 mois — barres
    const xd = 335;
    const ld = 220;
    titre('Lots enregistrés (12 derniers mois)', xd, y);
    const mois = [];
    const fin = new Date(s.genereLe);
    for (let i = 11; i >= 0; i--) mois.push(new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
    const parMois = mois.map((m) => lots.filter((l) => String(l.date || '').startsWith(m)).length);
    const maxM = Math.max(1, ...parMois);
    const hG = 72;
    const yb = y + 26 + hG;
    const lb = ld / 12;
    const lettres = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
    [0.5, 1].forEach((t) => {
      doc.moveTo(xd, yb - t * hG).lineTo(xd + ld, yb - t * hG).lineWidth(0.4).dash(2, { space: 2 }).strokeColor(LIGNE).stroke().undash();
    });
    parMois.forEach((n, i) => {
      const h = (n / maxM) * hG;
      if (h) doc.roundedRect(xd + i * lb + 3, yb - h, lb - 6, h, 2).fill(i === 11 ? '#D4A04A' : SAGE);
      if (n) doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(String(n), xd + i * lb, yb - h - 9, { width: lb, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(6).fillColor(MUTED).text(lettres[Number(mois[i].slice(5)) - 1], xd + i * lb - 2, yb + 4, { width: lb + 4, align: 'center', lineBreak: false });
    });
    doc.moveTo(xd, yb).lineTo(xd + ld, yb).lineWidth(0.8).strokeColor(SAGE).stroke();

    // 4a. Par discipline — barres horizontales
    y = 362;
    doc.moveTo(40, y - 8).lineTo(555, y - 8).lineWidth(0.5).strokeColor(LIGNE).stroke();
    titre('Les lots par discipline', 40, y);
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('vert = validés · clair = autres', 200, y + 3, { lineBreak: false });
    const disc = {};
    for (const l of lots) {
      const d = l.machine_type || 'non renseignée';
      disc[d] = disc[d] || { lots: 0, valides: 0 };
      disc[d].lots++;
      if (l.statut_affiche === 'valide') disc[d].valides++;
    }
    const lignesDisc = Object.entries(disc).sort((a, b) => b[1].lots - a[1].lots).slice(0, 10);
    const maxD = Math.max(1, ...lignesDisc.map(([, v]) => v.lots));
    let yd = y + 20;
    for (const [d, v] of lignesDisc) {
      const wTot = 140 * v.lots / maxD;
      const wVal = 140 * v.valides / maxD;
      doc.font('Helvetica').fontSize(8).fillColor(INK).text(NOMS_DISCIPLINES[d] || d, 40, yd, { width: 92, lineBreak: false });
      doc.roundedRect(134, yd + 1, wTot, 7.5, 2).fill('#E3ECE6');
      if (wVal) doc.roundedRect(134, yd + 1, wVal, 7.5, 2).fill(SAGE);
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
        .text(`${v.valides}/${v.lots} · ${Math.round(100 * v.valides / v.lots)} %`, 134 + wTot + 6, yd, { lineBreak: false });
      yd += 13.5;
    }

    // 4b. État des machines
    titre('État des machines', xd, y);
    let ym = y + 20;
    const enService = machines.filter((m) => (m.statut_service || 'en_service') === 'en_service').length;
    const maint = machines.filter((m) => m.statut_service === 'maintenance');
    const hs = machines.filter((m) => m.statut_service === 'hors_service');
    // petite barre empilée du parc
    const parts = [[enService, SAGE], [maint.length, '#D4A04A'], [hs.length, ROUGE]];
    let xx = xd;
    for (const [n, c] of parts) {
      const w = ld * n / Math.max(1, machines.length);
      if (w) doc.rect(xx, ym, w, 9).fill(c);
      xx += w;
    }
    ym += 17;
    const ligneM = (couleur, gras, texte) => {
      doc.circle(xd + 4, ym + 4, 3).fill(couleur);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(gras, xd + 12, ym, { continued: Boolean(texte), width: ld - 12 });
      if (texte) doc.font('Helvetica').fillColor(MUTED).text(texte);
      ym = doc.y + 4;
    };
    ligneM(SAGE, `${enService} en service`, '');
    ligneM('#D4A04A', `${maint.length} en maintenance`, maint.length ? ` : ${maint.map((m) => m.nom).join(', ')}` : '');
    ligneM(ROUGE, `${hs.length} hors service`, hs.length ? ` : ${hs.map((m) => m.nom).join(', ')}` : '');

    // 5. À traiter en priorité
    y = Math.max(yd, ym) + 12;
    doc.moveTo(40, y - 8).lineTo(555, y - 8).lineWidth(0.5).strokeColor(LIGNE).stroke();
    const ordre = { signale: 0, brouillon: 1, a_valider: 2, a_revalider: 3 };
    const prio = lots.filter((l) => l.statut_affiche in ordre)
      .sort((a, b) => ordre[a.statut_affiche] - ordre[b.statut_affiche] || String(b.date || '').localeCompare(String(a.date || '')));
    const nbLignes = Math.max(4, Math.floor((684 - (y + 34)) / 16));
    const montres = prio.slice(0, nbLignes);
    titre(`À traiter en priorité (${prio.length})`, 40, y);
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      .text('signalés d’abord, puis brouillons, lots à valider et à revalider', 200, y + 3, { width: 355, align: 'right', lineBreak: false });
    y += 18;
    const cp = [[40, 'Lot', 72], [112, 'Machine', 92], [204, 'Date', 50], [254, 'Statut', 62], [316, 'Action à faire', 239]];
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
    cp.forEach(([x0, lib, w]) => doc.text(lib, x0, y, { width: w, lineBreak: false }));
    doc.moveTo(40, y + 11).lineTo(555, y + 11).lineWidth(0.8).strokeColor(SAGE).stroke();
    y += 16;
    const coul = Object.fromEntries(COULEURS_STATUT.map(([c, , col]) => [c, col]));
    for (const l of montres) {
      doc.font('Helvetica').fontSize(7.8).fillColor(INK)
        .text(l.nom, 40, y, { width: 70, lineBreak: false })
        .text(l.machine_nom || 'non renseignée', 112, y, { width: 90, height: 10, ellipsis: true })
        .text(l.date ? formaterJour(l.date) : '-', 204, y, { width: 48, lineBreak: false });
      doc.circle(258, y + 3.5, 3).fill(coul[l.statut_affiche] || MUTED);
      doc.fillColor(INK).text(l.statut_libelle, 265, y, { width: 50, lineBreak: false });
      doc.fillColor(l.statut_affiche === 'signale' ? ROUGE : INK).text(actionPour(l), 316, y, { width: 239, height: 10, ellipsis: true });
      doc.moveTo(40, y + 12).lineTo(555, y + 12).lineWidth(0.4).strokeColor(LIGNE).stroke();
      y += 16;
    }
    if (prio.length > montres.length) {
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED)
        .text(`+ ${prio.length - montres.length} autre(s) lot(s) à traiter : liste complète sur le site (page Lots) ou dans l’export CSV.`, 40, y + 2, { width: 515, lineBreak: false });
    }

    // 6. Mode d'emploi de la note + visa + QR
    const yb2 = 702;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK).text('Lire la note de confiance (/100)', 40, yb2);
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(
      'Machine (15) + date (15) + conditions de mesure (15) + pseudonymisation sans colonne identifiante (20) + aucun signalement ouvert (20) + validation de moins de 12 mois (15).',
      40, yb2 + 11, { width: 245 });
    doc.rect(300, yb2, 175, 58).lineWidth(0.8).strokeColor(SAGE).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('Visa du biologiste · nom, date, signature', 308, yb2 + 7);
    if (qr) {
      try {
        doc.image(qr, 490, yb2 - 4, { width: 62 });
        doc.fontSize(6).fillColor(MUTED).text('Version en ligne', 480, yb2 + 59, { width: 80, align: 'center', lineBreak: false });
      } catch { /* image invalide : on ignore */ }
    }
    piedsDePage(doc, 'biologIA · fiche de synthèse · aucune donnée nominative · données fictives');
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
