const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db');
const { libelleStatut, csvAvecBom } = require('../lib/tracabilite');
const { formaterParis, formaterJour } = require('../lib/dates');

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
  return {
    totalLots: total,
    lotsValides: valides,
    lotsAnonymises: anonymises,
    signalementsEnCours: enCours,
    lotsAlerteIdentite: alertesIdentite,
    lotsDouteux: parStatut('signale'),
    lotsBrouillon: parStatut('brouillon'),
    lotsAValider: parStatut('a_valider'),
    lotsARevalider: parStatut('a_revalider'),
    lotsSansValidation: parStatut('a_valider') + parStatut('brouillon'),
    pourcentageValides: total ? Math.round((valides / total) * 100) : 0,
    pourcentageAnonymises: total ? Math.round((anonymises / total) * 100) : 0,
    par_machine: Object.values(machines),
    lots,
    genereLe: new Date().toISOString()
  };
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

function urlPublique() {
  if (process.env.PUBLIC_URL) return String(process.env.PUBLIC_URL).replace(/\/$/, '');
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'https://biologia.replit.app';
}

function couleursStatut(code) {
  if (code === 'valide') return { fond: '#ddf7ee', texte: '#0f6b4c' };
  if (code === 'signale') return { fond: '#fde8e9', texte: '#8d242c' };
  return { fond: '#f8ecd3', texte: '#7a5410' };
}

function garantirEspace(doc, hauteur) {
  const bas = doc.page.height - 52;
  if (doc.y + hauteur > bas) doc.addPage();
}

function dessinerTableau(doc, colonnes, lignes) {
  const x0 = 48;
  const largeur = doc.page.width - 96;
  const totalW = colonnes.reduce((s, c) => s + c.w, 0);
  const largeurs = colonnes.map((c) => (c.w / totalW) * largeur);
  const hautLigne = 18;

  const enTete = () => {
    const y0 = doc.y;
    let x = x0;
    doc.rect(x0, y0, largeur, hautLigne).fill('#18534F');
    doc.fillColor('#F5F5DC').fontSize(8).font('Helvetica-Bold');
    colonnes.forEach((c, i) => {
      doc.text(c.label, x + 4, y0 + 5, { width: largeurs[i] - 8, lineBreak: false });
      x += largeurs[i];
    });
    doc.y = y0 + hautLigne;
    doc.font('Helvetica');
  };

  garantirEspace(doc, hautLigne * 2);
  enTete();
  lignes.forEach((ligne, idx) => {
    if (doc.y + hautLigne > doc.page.height - 52) {
      doc.addPage();
      enTete();
    }
    const y = doc.y;
    const fond = ligne.fond || (idx % 2 ? '#F7EFE0' : '#FFFFFF');
    doc.rect(x0, y, largeur, hautLigne).fill(fond);
    let x = x0;
    colonnes.forEach((c, i) => {
      doc.fillColor(ligne.couleurs && ligne.couleurs[i] ? ligne.couleurs[i] : '#16241E')
        .fontSize(8)
        .text(String(ligne.cellules[i] ?? ''), x + 4, y + 5, { width: largeurs[i] - 8, lineBreak: false });
      x += largeurs[i];
    });
    doc.y = y + hautLigne;
  });
  doc.fillColor('#16241E');
}

async function bufferQr(url) {
  try {
    const QRCode = require('qrcode');
    return await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 132, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

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
    const site = urlPublique();
    const qr = await bufferQr(site);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-synthese.pdf"');

    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
    doc.pipe(res);

    const logo = path.join(__dirname, '..', '..', 'frontend', 'logo.png');
    if (fs.existsSync(logo)) {
      try { doc.image(logo, 48, 36, { width: 48 }); } catch { /* logo optionnel */ }
    }
    doc.fontSize(18).fillColor('#18534F').text('Fiche de synthèse — Contrôle qualité', 108, 40, { width: 360 });
    doc.fontSize(10).fillColor('#4C5850').text('Registre de traçabilité biologIA — démonstrateur pédagogique', 108, 66, { width: 360 });
    const emise = req.utilisateur
      ? `Émise par ${req.utilisateur.nom} (${req.utilisateur.role}) le ${formaterParis(s.genereLe)}`
      : `Générée le ${formaterParis(s.genereLe)}`;
    doc.text(emise, 108, 80, { width: 360 });

    doc.y = 118;
    doc.fillColor('#16241E').fontSize(12);
    doc.text(`Lots enregistrés : ${s.totalLots}   ·   validés par un biologiste : ${s.lotsValides} (${s.pourcentageValides} %)`);
    doc.text(`Pseudonymisés : ${s.lotsAnonymises} (${s.pourcentageAnonymises} %)   ·   signalements ouverts : ${s.signalementsEnCours}`);
    doc.text(`Brouillon ${s.lotsBrouillon}  ·  À valider ${s.lotsAValider}  ·  À revalider ${s.lotsARevalider}  ·  Signalé ${s.lotsDouteux}`);

    doc.moveDown(0.9);
    doc.fontSize(13).fillColor('#18534F').text('Répartition par machine');
    doc.moveDown(0.25);
    dessinerTableau(doc, [
      { label: 'Machine', w: 3 },
      { label: 'Lots', w: 1 },
      { label: 'Validés', w: 1 },
      { label: 'Taux', w: 1 }
    ], (s.par_machine.length ? s.par_machine : [{ nom: 'Aucune', lots: 0, valides: 0 }]).map((m) => ({
      cellules: [
        m.nom,
        String(m.lots),
        String(m.valides),
        m.lots ? `${Math.round((m.valides / m.lots) * 100)} %` : '—'
      ]
    })));

    doc.moveDown(0.9);
    doc.fontSize(13).fillColor('#18534F').text('Lots');
    doc.moveDown(0.25);
    if (!s.lots.length) {
      doc.fontSize(10).fillColor('#4C5850').text('Aucun lot enregistré (hors lots TEST).');
    } else {
      dessinerTableau(doc, [
        { label: 'Réf.', w: 1.1 },
        { label: 'Lot', w: 2.6 },
        { label: 'Machine', w: 2 },
        { label: 'Date', w: 1.3 },
        { label: 'Statut', w: 1.5 },
        { label: 'Score', w: 0.9 }
      ], s.lots.map((lot) => {
        const c = couleursStatut(lot.statut_affiche);
        return {
          fond: c.fond,
          couleurs: ['#16241E', '#16241E', '#16241E', '#16241E', c.texte, '#16241E'],
          cellules: [
            `L-${String(lot.id).padStart(3, '0')}`,
            lot.nom,
            lot.machine_nom || 'n/r',
            formaterJour(lot.date),
            lot.statut_libelle,
            String(lot.score_confiance)
          ]
        };
      }));
    }

    doc.moveDown(0.9);
    doc.fontSize(13).fillColor('#18534F').text('Signalements ouverts');
    doc.moveDown(0.25);
    if (!signalements.length) {
      doc.fontSize(10).fillColor('#4C5850').text('Aucun signalement ouvert.');
    } else {
      dessinerTableau(doc, [
        { label: 'Lot', w: 2 },
        { label: 'Motif', w: 5 }
      ], signalements.map((sig) => ({
        fond: '#fde8e9',
        cellules: [sig.lot_nom, sig.raison]
      })));
    }

    garantirEspace(doc, 150);
    doc.moveDown(1);
    const ySign = doc.y;
    doc.fontSize(12).fillColor('#18534F').text('Zone de signature du biologiste', 48, ySign);
    doc.strokeColor('#18534F').lineWidth(0.8);
    doc.rect(48, ySign + 22, 280, 56).stroke();
    doc.fontSize(8).fillColor('#4C5850').text('Nom, date et paraphe', 56, ySign + 70);

    if (qr) {
      try { doc.image(qr, 400, ySign + 8, { width: 92 }); } catch { /* ignore */ }
      doc.fontSize(8).fillColor('#4C5850').text('QR vers le site', 400, ySign + 104, { width: 92, align: 'center' });
    } else {
      doc.rect(400, ySign + 22, 92, 56).stroke('#18534F');
      doc.fontSize(7).fillColor('#4C5850').text(site, 404, ySign + 40, { width: 84 });
    }

    const plage = doc.bufferedPageRange();
    for (let i = 0; i < plage.count; i++) {
      doc.switchToPage(plage.start + i);
      doc.fontSize(8).fillColor('#4C5850').text(
        `biologIA — ${emise} — ${site} — page ${i + 1} / ${plage.count}`,
        48,
        doc.page.height - 32,
        { width: doc.page.width - 96, align: 'center' }
      );
    }
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
