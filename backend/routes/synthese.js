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
    const L = 515; // largeur utile
    const PAPIER = '#F4F1E8';
    const LIGNE = '#DDD6C8';
    const ROUGE = '#C85A4A';
    const emise = req.utilisateur
      ? `Émise par ${req.utilisateur.nom} (${req.utilisateur.role}) · ${formaterParis(s.genereLe)}`
      : `Générée le ${formaterParis(s.genereLe)}`;
    enTete(doc, 'Fiche de synthèse — contrôle qualité', `${emise} · plateau technique de Nice`);

    const titre = (texte, x, y) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(texte, x, y, { lineBreak: false });
    };
    const noteMoy = lots.length ? Math.round(lots.reduce((t, l) => t + (Number(l.score_confiance) || 0), 0) / lots.length) : 0;
    const aTraiter = lots.filter((l) => l.statut_affiche !== 'valide').length;

    // 1. Le message principal, en une phrase
    let y = 120;
    doc.roundedRect(40, y, L, 34, 6).fill(PAPIER);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK)
      .text(`${s.totalLots} lots suivis sur ${machines.length} machines : ${s.pourcentageValides} % sont validés et utilisables.`, 52, y + 7, { width: L - 24, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
      .text(`${aTraiter} lot(s) demandent une action, dont ${s.lotsDouteux} signalé(s) à examiner en premier (liste en bas de page).`, 52, y + 20, { width: L - 24, lineBreak: false });

    // 2. Chiffres clés
    y = 166;
    const tuiles = [
      [String(s.totalLots), 'lots suivis', SAGE],
      [`${s.pourcentageValides} %`, 'validés par un biologiste', SAGE],
      [`${s.pourcentageAnonymises} %`, 'pseudonymisés (sans nom)', SAGE],
      [`${noteMoy}/100`, 'note de confiance moyenne', SAGE],
      [String(s.signalementsEnCours), `signalements ouverts (sur ${s.lotsDouteux} lot${s.lotsDouteux > 1 ? 's' : ''})`, s.signalementsEnCours ? ROUGE : SAGE]
    ];
    const lt = (L - 4 * 8) / 5;
    tuiles.forEach(([v, lib, c], i) => {
      const x = 40 + i * (lt + 8);
      doc.roundedRect(x, y, lt, 54, 6).lineWidth(0.8).strokeColor(LIGNE).stroke();
      doc.rect(x, y + 8, 3, 38).fill(c);
      doc.font('Helvetica-Bold').fontSize(17).fillColor(c === ROUGE ? ROUGE : INK).text(v, x + 12, y + 10, { width: lt - 18, lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(lib, x + 12, y + 33, { width: lt - 18, height: 18 });
    });

    // 3. Où en sont les lots ? (barre empilée)
    y = 236;
    titre('Où en sont les lots ?', 40, y);
    y += 17;
    let x = 40;
    const comptes = COULEURS_STATUT.map(([code, lib, c]) => [lots.filter((l) => l.statut_affiche === code).length, lib, c]);
    comptes.forEach(([n, , c]) => {
      if (!n) return;
      const w = (n / Math.max(1, s.totalLots)) * L;
      doc.rect(x, y, w, 13).fill(c);
      x += w;
    });
    y += 19;
    x = 40;
    comptes.forEach(([n, lib, c]) => {
      doc.circle(x + 4, y + 4, 3.5).fill(c);
      const t = `${lib} : ${n} (${Math.round(100 * n / Math.max(1, s.totalLots))} %)`;
      doc.font('Helvetica').fontSize(7.8).fillColor(INK).text(t, x + 11, y, { lineBreak: false });
      x += doc.widthOfString(t) + 26;
    });

    // 4a. Par discipline
    y = 292;
    titre('Par discipline', 40, y);
    const disc = {};
    for (const l of lots) {
      const d = l.machine_type || 'non renseignée';
      disc[d] = disc[d] || { lots: 0, valides: 0, note: 0, signales: 0 };
      disc[d].lots++;
      disc[d].note += Number(l.score_confiance) || 0;
      if (l.statut_affiche === 'valide') disc[d].valides++;
      if (l.statut_affiche === 'signale') disc[d].signales++;
    }
    const lignesDisc = Object.entries(disc).sort((a, b) => b[1].lots - a[1].lots).slice(0, 11);
    const cols = [[40, 'Discipline', 98], [138, 'Machines', 44], [182, 'Lots', 32], [214, 'Validés', 46], [260, 'Note moy.', 46]];
    let yt = y + 18;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
    cols.forEach(([cx, lib, w], i) => doc.text(lib, cx, yt, { width: w - 4, align: i ? 'right' : 'left', lineBreak: false }));
    doc.moveTo(40, yt + 11).lineTo(306, yt + 11).lineWidth(0.8).strokeColor(SAGE).stroke();
    yt += 15;
    for (const [d, v] of lignesDisc) {
      const nbM = machines.filter((m) => m.type === d).length;
      const pct = Math.round(100 * v.valides / v.lots);
      const cells = [NOMS_DISCIPLINES[d] || d, String(nbM), String(v.lots), `${pct} %`, String(Math.round(v.note / v.lots))];
      doc.font('Helvetica').fontSize(7.8).fillColor(INK);
      cells.forEach((c, i) => doc.text(c, cols[i][0], yt, { width: cols[i][2] - 4, align: i ? 'right' : 'left', lineBreak: false }));
      yt += 14.5;
    }

    // 4b. Activité des 12 derniers mois
    const xd = 330;
    const ld = 225;
    titre('Lots enregistrés (12 derniers mois)', xd, y);
    const mois = [];
    const fin = new Date(s.genereLe);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - i, 1));
      mois.push(d.toISOString().slice(0, 7));
    }
    const parMois = mois.map((m) => lots.filter((l) => String(l.date || '').startsWith(m)).length);
    const maxM = Math.max(1, ...parMois);
    const hG = 62;
    const yb = y + 22 + hG;
    const lb = ld / 12;
    const lettres = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    parMois.forEach((n, i) => {
      const h = (n / maxM) * hG;
      doc.rect(xd + i * lb + 2, yb - h, lb - 4, h).fill(SAGE);
      if (n) doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(String(n), xd + i * lb, yb - h - 9, { width: lb, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(lettres[Number(mois[i].slice(5)) - 1], xd + i * lb, yb + 3, { width: lb, align: 'center', lineBreak: false });
    });
    doc.moveTo(xd, yb).lineTo(xd + ld, yb).lineWidth(0.5).strokeColor(LIGNE).stroke();

    // 4c. État du parc de machines
    let ym = yb + 22;
    titre('État des machines', xd, ym);
    ym += 16;
    const enService = machines.filter((m) => (m.statut_service || 'en_service') === 'en_service').length;
    const maint = machines.filter((m) => m.statut_service === 'maintenance');
    const hs = machines.filter((m) => m.statut_service === 'hors_service');
    const ligneM = (couleur, texte) => {
      doc.circle(xd + 4, ym + 4, 3).fill(couleur);
      doc.font('Helvetica').fontSize(7.8).fillColor(INK).text(texte, xd + 12, ym, { width: ld - 12 });
      ym = doc.y + 3;
    };
    ligneM(SAGE, `${enService} en service`);
    ligneM('#D4A04A', `${maint.length} en maintenance : ${maint.map((m) => m.nom).join(', ')}`);
    ligneM(ROUGE, `${hs.length} hors service${hs.length ? ' : ' + hs.map((m) => m.nom).join(', ') : ''}`);

    // 5. À traiter en priorité
    y = Math.max(yt, ym) + 14;
    const ordre = { signale: 0, brouillon: 1, a_valider: 2, a_revalider: 3 };
    const prio = lots.filter((l) => l.statut_affiche in ordre)
      .sort((a, b) => ordre[a.statut_affiche] - ordre[b.statut_affiche] || String(b.date || '').localeCompare(String(a.date || '')));
    const place = Math.max(4, Math.floor((680 - (y + 34)) / 15));
    const montres = prio.slice(0, place);
    titre(`À traiter en priorité (${prio.length})`, 40, y);
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
      .text('Les signalés d’abord, puis les brouillons, les lots à valider et à revalider.', 210, y + 2, { width: 345, align: 'right', lineBreak: false });
    y += 17;
    const cp = [[40, 'Lot', 70], [110, 'Machine', 92], [202, 'Date', 50], [252, 'Statut', 62], [314, 'Action à faire', 241]];
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
    cp.forEach(([cx, lib, w]) => doc.text(lib, cx, y, { width: w, lineBreak: false }));
    doc.moveTo(40, y + 11).lineTo(555, y + 11).lineWidth(0.8).strokeColor(SAGE).stroke();
    y += 15;
    const coul = Object.fromEntries(COULEURS_STATUT.map(([c, , col]) => [c, col]));
    montres.forEach((l, i) => {
      if (i % 2 === 0) doc.rect(40, y - 3, L, 15).fill('#FAF8F3');
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(INK).text(l.nom, 42, y, { width: 68, lineBreak: false });
      doc.font('Helvetica').fontSize(7.8).fillColor(INK)
        .text(l.machine_nom || 'non renseignée', 110, y, { width: 90, height: 10, ellipsis: true })
        .text(l.date ? formaterJour(l.date) : '-', 202, y, { width: 48, lineBreak: false });
      doc.circle(256, y + 3.5, 3).fill(coul[l.statut_affiche] || MUTED);
      doc.fillColor(INK).text(l.statut_libelle, 263, y, { width: 50, lineBreak: false });
      doc.fillColor(l.statut_affiche === 'signale' ? ROUGE : INK).text(actionPour(l), 314, y, { width: 241, height: 10, ellipsis: true });
      y += 15;
    });
    if (prio.length > montres.length) {
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED)
        .text(`+ ${prio.length - montres.length} autre(s) lot(s) à traiter : liste complète sur le site (page Lots) ou dans l’export CSV.`, 40, y + 2, { width: L, lineBreak: false });
    }

    // 6. Comment lire + signature + QR (bas de page fixe)
    const yb2 = 700;
    doc.moveTo(40, yb2 - 8).lineTo(555, yb2 - 8).lineWidth(0.5).strokeColor(LIGNE).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK).text('Comment lire la note de confiance (/100)', 40, yb2);
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(
      'Machine (15) + date (15) + conditions de mesure (15) + pseudonymisation sans colonne identifiante (20) + aucun signalement ouvert (20) + validation de moins de 12 mois (15). 80 et plus : lot bien documenté.',
      40, yb2 + 11, { width: 250 });
    doc.roundedRect(305, yb2, 170, 62, 5).lineWidth(0.8).strokeColor(SAGE).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('Visa du biologiste responsable', 313, yb2 + 7);
    doc.text('Nom :', 313, yb2 + 24).text('Date :              Signature :', 313, yb2 + 40);
    if (qr) {
      try {
        doc.image(qr, 490, yb2 - 2, { width: 62 });
        doc.fontSize(6).fillColor(MUTED).text('Version en ligne', 480, yb2 + 61, { width: 80, align: 'center', lineBreak: false });
      } catch { /* image invalide : on ignore */ }
    }
    piedsDePage(doc, 'Fiche de synthèse biologIA · aucune donnée nominative · données fictives');
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
