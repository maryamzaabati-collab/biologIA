const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  analyserCsv,
  problemesLot,
  valeurHistorique,
  historiqueDifferent,
  colonnesSensibles,
  scoreConfiance,
  detailScoreConfiance,
  libelleStatut,
  genererCodeVerification,
  MOIS_PEREMPTION
} = require('../lib/tracabilite');
const journal = require('../lib/journal');
const { formaterParis, isoUtc, horlogeParis } = require('../lib/dates');

async function verifierEtSignaler(lotId, champs) {
  const problemes = problemesLot(champs);
  const statut = problemes.length === 0 ? 'ok' : 'douteux';
  await db.run('UPDATE lots SET statut = ? WHERE id = ?', [statut, lotId]);
  await db.run('DELETE FROM signalements WHERE lot_id = ?', [lotId]);
  for (const raison of problemes) {
    await db.run('INSERT INTO signalements (lot_id, raison) VALUES (?, ?)', [lotId, raison]);
  }
  return { statut, problemes };
}

function payloadLot(body, ancien) {
  const analyse = analyserCsv(body.csv_texte || '');
  let colonnesFinales = analyse.colonnes;
  if (!colonnesFinales.length && Array.isArray(body.colonnes)) colonnesFinales = body.colonnes;
  if (!colonnesFinales.length && ancien?.colonnes_csv) {
    try { colonnesFinales = JSON.parse(ancien.colonnes_csv) || []; } catch { colonnesFinales = []; }
  }
  const sensiblesFinales = colonnesSensibles(colonnesFinales);

  let valeurs = analyse.valeurs;
  let moyenneControle = analyse.moyenne;
  if (!valeurs.length && ancien?.valeurs_controle) {
    try { valeurs = JSON.parse(ancien.valeurs_controle) || []; } catch { valeurs = []; }
    moyenneControle = ancien.moyenne_controle;
  }

  return {
    nom: body.nom,
    machine_id: body.machine_id ? Number(body.machine_id) : null,
    date: body.date || null,
    conditions: body.conditions || null,
    anonymise: body.anonymise ? 1 : 0,
    colonnes_csv: colonnesFinales.length ? JSON.stringify(colonnesFinales) : null,
    alerte_identite: sensiblesFinales.length ? 1 : 0,
    sensibles: sensiblesFinales,
    valeurs_controle: valeurs.length ? JSON.stringify(valeurs) : null,
    moyenne_controle: moyenneControle
  };
}

function uniqueValidations(liste) {
  const vus = new Set();
  return (liste || []).filter((v) => {
    if (vus.has(v.nom_biologiste)) return false;
    vus.add(v.nom_biologiste);
    return true;
  });
}

function enrichir(lot, validations = []) {
  const n = Number(lot.nb_signalements) || 0;
  const detail = detailScoreConfiance(lot, validations, n);
  const statutVu = libelleStatut(lot, validations, n);
  return {
    ...lot,
    score_confiance: detail.score,
    score_detail: detail.lignes,
    statut_affiche: statutVu.code,
    statut_libelle: statutVu.libelle,
    mois_peremption: MOIS_PEREMPTION
  };
}

router.post('/analyser-csv', (req, res) => {
  const analyse = analyserCsv(req.body.csv_texte || '');
  res.json({
    colonnes: analyse.colonnes,
    sensibles: analyse.sensibles,
    nb_valeurs: analyse.valeurs.length,
    moyenne: analyse.moyenne
  });
});

router.get('/', async (req, res) => {
  try {
    const clauses = [];
    const params = [];
    if (req.query.machine_id) {
      clauses.push('lots.machine_id = ?');
      params.push(req.query.machine_id);
    }
    if (req.query.statut) {
      clauses.push('lots.statut = ?');
      params.push(req.query.statut);
    }
    if (req.query.date) {
      clauses.push('lots.date = ?');
      params.push(req.query.date);
    }
    if (req.query.q) {
      clauses.push('(lots.nom LIKE ? OR lots.code_verification LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const lots = await db.all(`
      SELECT lots.*, machines.nom AS machine_nom,
        (SELECT COUNT(*) FROM signalements WHERE lot_id = lots.id AND resolu = 0) AS nb_signalements
      FROM lots LEFT JOIN machines ON lots.machine_id = machines.id
      ${where}
      ORDER BY lots.date_creation DESC
    `, params);

    const enrichis = [];
    for (const lot of lots) {
      const validations = await db.all(
        'SELECT * FROM validations WHERE lot_id = ? ORDER BY date_validation DESC',
        [lot.id]
      );
      enrichis.push(enrichir(lot, uniqueValidations(validations)));
    }
    res.json(enrichis);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/par-code/:code', async (req, res) => {
  try {
    const lot = await db.get('SELECT id FROM lots WHERE code_verification = ?', [req.params.code]);
    if (!lot) return res.status(404).json({ erreur: "Aucun lot pour ce code de vérification." });
    res.json({ id: lot.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/:id/historique', async (req, res) => {
  try {
    const lot = await db.get('SELECT id FROM lots WHERE id = ?', [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });
    const lignes = await db.all(
      'SELECT * FROM historique_lots WHERE lot_id = ? ORDER BY date DESC, id DESC',
      [req.params.id]
    );
    res.json(lignes);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/:id/certificat', async (req, res) => {
  try {
    const lot = await db.get(`
      SELECT lots.*, machines.nom AS machine_nom, machines.type AS machine_type
      FROM lots LEFT JOIN machines ON lots.machine_id = machines.id
      WHERE lots.id = ?
    `, [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });

    const validations = await db.all(
      'SELECT * FROM validations WHERE lot_id = ? ORDER BY date_validation DESC',
      [req.params.id]
    );
    const regles = await db.all('SELECT * FROM regles_alerte WHERE lot_id = ?', [req.params.id]);
    const vu = enrichir(lot, uniqueValidations(validations));

    const PDFDocument = require('pdfkit');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificat-${lot.code_verification || lot.id}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(16).text('Certificat de traçabilité', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#4C5850').text(
      'Registre des données de référence — esprit ISO 15189 / ISO 17025',
      { align: 'center' }
    );
    doc.moveDown(1.2);
    doc.fillColor('#16241E').fontSize(12);
    doc.text(`Lot : ${lot.nom}`);
    doc.text(`Référence interne : L-${String(lot.id).padStart(3, '0')}`);
    doc.text(`Code de vérification : ${lot.code_verification || 'n/r'}`);
    doc.text(`Machine : ${lot.machine_nom || 'non renseignée'} (${lot.machine_type || 'type n/r'})`);
    doc.text(`Date de mesure : ${lot.date || 'non renseignée'}`);
    doc.text(`Conditions : ${lot.conditions || 'non renseignées'}`);
    doc.text(`Pseudonymisation confirmée : ${lot.anonymise ? 'oui' : 'non'}`);
    doc.text(`Statut : ${vu.statut_libelle}`);
    doc.text(`Score de confiance : ${vu.score_confiance} / 100`);
    doc.moveDown(0.8);
    doc.fontSize(12).text('Règles d\'alerte calibrées sur ce lot');
    doc.fontSize(10);
    if (!regles.length) doc.text('Aucune règle associée.');
    regles.forEach((r) => {
      doc.text(`- ${r.parametre} : ${r.seuil_bas ?? '—'} à ${r.seuil_haut ?? '—'} ${r.unite || ''}`);
    });
    doc.moveDown(0.8);
    doc.fontSize(12).text('Validations biologiste');
    doc.fontSize(10);
    if (!validations.length) doc.text('Aucune validation enregistrée.');
    validations.forEach((v) => {
      doc.text(`- ${v.nom_biologiste} — ${formaterParis(v.date_validation)}`);
    });
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#4C5850').text(
      'Document généré par le registre de traçabilité. Données de référence fictives — aucun bilan patient.'
    );
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erreur: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lot = await db.get(`
      SELECT lots.*, machines.nom AS machine_nom, machines.type AS machine_type,
        (SELECT COUNT(*) FROM signalements WHERE lot_id = lots.id AND resolu = 0) AS nb_signalements
      FROM lots LEFT JOIN machines ON lots.machine_id = machines.id
      WHERE lots.id = ?
    `, [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });

    const validations = await db.all(
      'SELECT * FROM validations WHERE lot_id = ? ORDER BY date_validation DESC',
      [req.params.id]
    );
    const historique = await db.all(
      'SELECT * FROM historique_lots WHERE lot_id = ? ORDER BY id DESC',
      [req.params.id]
    );
    const signalements = await db.all(
      'SELECT * FROM signalements WHERE lot_id = ? AND resolu = 0 ORDER BY date DESC',
      [req.params.id]
    );
    const reglesAlerte = await db.all(
      'SELECT * FROM regles_alerte WHERE lot_id = ? ORDER BY parametre',
      [req.params.id]
    );
    res.json({
      ...enrichir(lot, uniqueValidations(validations)),
      validations: uniqueValidations(validations).map((v) => ({
        ...v,
        date_validation: isoUtc(v.date_validation),
        date_validation_paris: formaterParis(v.date_validation)
      })),
      historique: historique.map((h) => ({
        ...h,
        date: isoUtc(h.date),
        date_paris: formaterParis(h.date)
      })),
      signalements,
      reglesAlerte
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  const data = payloadLot(req.body);
  if (!data.nom) return res.status(400).json({ erreur: 'Le nom du lot est obligatoire.' });

  try {
    const code = genererCodeVerification();
    const { id } = await db.run(
      `INSERT INTO lots (nom, machine_id, date, conditions, anonymise, colonnes_csv, alerte_identite,
        code_verification, moyenne_controle, valeurs_controle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.nom, data.machine_id, data.date, data.conditions, data.anonymise, data.colonnes_csv,
        data.alerte_identite, code, data.moyenne_controle, data.valeurs_controle]
    );
    await verifierEtSignaler(id, {
      machine_id: data.machine_id,
      date: data.date,
      conditions: data.conditions,
      anonymise: data.anonymise,
      sensibles: data.sensibles
    });
    await journal.enregistrer(req, 'création lot', `lot ${id}`, data.nom);
    res.status(201).json({
      id,
      nom: data.nom,
      code_verification: code,
      alerte_identite: data.alerte_identite,
      sensibles: data.sensibles
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const ancien = await db.get('SELECT * FROM lots WHERE id = ?', [req.params.id]);
    if (!ancien) return res.status(404).json({ erreur: "Ce lot n'existe pas." });
    const data = payloadLot(req.body, ancien);
    if (!data.nom) return res.status(400).json({ erreur: 'Le nom du lot est obligatoire.' });

    const champs = [
      ['nom', ancien.nom, data.nom],
      ['machine_id', ancien.machine_id, data.machine_id],
      ['date', ancien.date, data.date],
      ['conditions', ancien.conditions, data.conditions],
      ['anonymise', ancien.anonymise, data.anonymise]
    ];
    if (String(req.body.csv_texte || '').trim()) {
      champs.push(['colonnes_csv', ancien.colonnes_csv, data.colonnes_csv]);
    }
    for (const [champ, avant, apres] of champs) {
      if (historiqueDifferent(champ, avant, apres)) {
        const dernier = await db.get(
          'SELECT ancienne_valeur, nouvelle_valeur FROM historique_lots WHERE lot_id = ? AND champ = ? ORDER BY id DESC LIMIT 1',
          [req.params.id, champ]
        );
        if (
          dernier
          && valeurHistorique(dernier.ancienne_valeur) === valeurHistorique(avant)
          && valeurHistorique(dernier.nouvelle_valeur) === valeurHistorique(apres)
        ) {
          continue;
        }
        await db.run(
          'INSERT INTO historique_lots (lot_id, champ, ancienne_valeur, nouvelle_valeur, date) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, champ, valeurHistorique(avant), valeurHistorique(apres), horlogeParis()]
        );
      }
    }

    await db.run(
      `UPDATE lots SET nom = ?, machine_id = ?, date = ?, conditions = ?, anonymise = ?,
        colonnes_csv = ?, alerte_identite = ?, moyenne_controle = ?, valeurs_controle = ? WHERE id = ?`,
      [data.nom, data.machine_id, data.date, data.conditions, data.anonymise,
        data.colonnes_csv, data.alerte_identite, data.moyenne_controle, data.valeurs_controle, req.params.id]
    );
    await verifierEtSignaler(req.params.id, {
      machine_id: data.machine_id,
      date: data.date,
      conditions: data.conditions,
      anonymise: data.anonymise,
      sensibles: data.sensibles
    });
    await journal.enregistrer(req, 'modification lot', `lot ${req.params.id}`, data.nom);
    res.json({ message: 'Lot mis à jour.', alerte_identite: data.alerte_identite, sensibles: data.sensibles });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const lot = await db.get('SELECT id FROM lots WHERE id = ?', [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });
    await db.run('DELETE FROM signalements WHERE lot_id = ?', [req.params.id]);
    await db.run('DELETE FROM validations WHERE lot_id = ?', [req.params.id]);
    await db.run('DELETE FROM historique_lots WHERE lot_id = ?', [req.params.id]);
    await db.run('DELETE FROM regles_alerte WHERE lot_id = ?', [req.params.id]);
    await db.run('DELETE FROM lots WHERE id = ?', [req.params.id]);
    await journal.enregistrer(req, 'suppression lot', `lot ${req.params.id}`, '');
    res.json({ message: 'Lot supprimé.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/:id/validations', async (req, res) => {
  const { utilisateur_id, nom_biologiste } = req.body;
  try {
    const lot = await db.get('SELECT id FROM lots WHERE id = ?', [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });

    let biologiste = null;
    if (utilisateur_id) {
      biologiste = await db.get(
        'SELECT * FROM utilisateurs WHERE id = ? AND role = ?',
        [utilisateur_id, 'biologiste']
      );
    } else if (nom_biologiste) {
      biologiste = await db.get(
        'SELECT * FROM utilisateurs WHERE nom = ? AND role = ?',
        [nom_biologiste, 'biologiste']
      );
    }
    if (!biologiste) {
      return res.status(400).json({ erreur: 'Choisissez un biologiste enregistre dans la liste.' });
    }

    const recente = await db.get(
      `SELECT id FROM validations
       WHERE lot_id = ? AND nom_biologiste = ?
         AND date_validation >= datetime('now', '-2 minutes')
       ORDER BY id DESC LIMIT 1`,
      [req.params.id, biologiste.nom]
    );
    if (recente) {
      return res.status(200).json({ id: recente.id, nom_biologiste: biologiste.nom, deja: true });
    }

    const { id } = await db.run(
      "INSERT INTO validations (lot_id, nom_biologiste, date_validation) VALUES (?, ?, ?)",
      [req.params.id, biologiste.nom, horlogeParis()]
    );
    await journal.enregistrer(req, 'validation lot', `lot ${req.params.id}`, biologiste.nom);
    res.status(201).json({ id, nom_biologiste: biologiste.nom });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
