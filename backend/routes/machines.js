const express = require('express');
const router = express.Router();
const db = require('../db');
const journal = require('../lib/journal');
const { enrichirMachine } = require('../lib/machine-statut');

router.get('/', async (req, res) => {
  try {
    const machines = await db.all(`
      SELECT machines.*,
        (SELECT MAX(lots.date) FROM lots WHERE lots.machine_id = machines.id AND COALESCE(lots.est_test, 0) = 0) AS derniere_mesure,
        (SELECT COUNT(*) FROM lots WHERE lots.machine_id = machines.id AND COALESCE(lots.archive, 0) = 0 AND COALESCE(lots.est_test, 0) = 0) AS nb_lots,
        (SELECT COUNT(*) FROM lots WHERE lots.machine_id = machines.id AND COALESCE(lots.archive, 0) = 0 AND COALESCE(lots.est_test, 0) = 1) AS nb_test
      FROM machines ORDER BY nom
    `);
    res.json(machines.map((m) => {
      const e = enrichirMachine(m);
      return { ...e, derniere_calibration: e.date_calibration || m.derniere_mesure };
    }));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { libelleStatut, detailScoreConfiance } = require('../lib/tracabilite');
    const m = await db.get('SELECT * FROM machines WHERE id = ?', [req.params.id]);
    if (!m) return res.status(404).json({ erreur: "Cette machine n'existe pas." });
    const lotsBruts = await db.all(
      `SELECT lots.*, 
        (SELECT COUNT(*) FROM signalements WHERE lot_id = lots.id AND resolu = 0) AS nb_signalements
       FROM lots WHERE machine_id = ? AND COALESCE(archive, 0) = 0
       ORDER BY date DESC, id DESC`,
      [req.params.id]
    );
    const lots = [];
    for (const lot of lotsBruts) {
      const vals = await db.all('SELECT * FROM validations WHERE lot_id = ? ORDER BY date_validation DESC', [lot.id]);
      const vu = libelleStatut(lot, vals, Number(lot.nb_signalements) || 0);
      const sc = detailScoreConfiance(lot, vals, Number(lot.nb_signalements) || 0);
      lots.push({
        id: lot.id,
        nom: lot.nom,
        date: lot.date,
        code_verification: lot.code_verification,
        est_test: lot.est_test,
        statut_affiche: vu.code,
        statut_libelle: vu.libelle,
        score_confiance: sc.score,
        nb_signalements: Number(lot.nb_signalements) || 0
      });
    }
    const horsTest = lots.filter((l) => !Number(l.est_test));
    const signalements = await db.all(
      `SELECT signalements.id, signalements.raison, signalements.date, lots.id AS lot_id, lots.nom AS lot_nom
       FROM signalements JOIN lots ON lots.id = signalements.lot_id
       WHERE lots.machine_id = ? AND signalements.resolu = 0 AND COALESCE(lots.archive, 0) = 0 AND COALESCE(lots.est_test, 0) = 0
       ORDER BY signalements.date DESC`,
      [req.params.id]
    );
    const histo = await db.all('SELECT * FROM calibrations WHERE machine_id = ? ORDER BY date DESC', [req.params.id]);
    const valides = horsTest.filter((l) => l.statut_affiche === 'valide').length;
    const scoreMoyen = horsTest.length
      ? Math.round(horsTest.reduce((s, l) => s + (Number(l.score_confiance) || 0), 0) / horsTest.length)
      : 0;
    res.json({
      ...enrichirMachine(m),
      lots,
      calibrations: histo,
      signalements,
      stats: {
        lots: horsTest.length,
        valides,
        score_moyen: scoreMoyen,
        signalements: signalements.length
      }
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  const { nom, type, date_calibration, statut_service, date_maintenance } = req.body;
  if (!nom) return res.status(400).json({ erreur: 'Le nom de la machine est obligatoire.' });
  try {
    const { id } = await db.run(
      'INSERT INTO machines (nom, type, date_calibration, statut_service, date_maintenance) VALUES (?, ?, ?, ?, ?)',
      [nom, type || '', date_calibration || null, statut_service || 'en_service', date_maintenance || null]
    );
    if (date_calibration) {
      await db.run(
        'INSERT INTO calibrations (machine_id, date, commentaire) VALUES (?, ?, ?)',
        [id, date_calibration, 'création']
      );
    }
    await journal.enregistrer(req, 'création machine', `machine ${id}`, nom);
    res.status(201).json({ id, nom, type });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const m = await db.get('SELECT * FROM machines WHERE id = ?', [req.params.id]);
    if (!m) return res.status(404).json({ erreur: "Cette machine n'existe pas." });
    const nom = req.body.nom != null ? req.body.nom : m.nom;
    const type = req.body.type != null ? req.body.type : m.type;
    const statut = req.body.statut_service || m.statut_service || 'en_service';
    const cal = req.body.date_calibration != null ? req.body.date_calibration : m.date_calibration;
    const maint = req.body.date_maintenance != null ? req.body.date_maintenance : m.date_maintenance;
    await db.run(
      'UPDATE machines SET nom = ?, type = ?, statut_service = ?, date_calibration = ?, date_maintenance = ? WHERE id = ?',
      [nom, type, statut, cal || null, maint || null, m.id]
    );
    if (req.body.date_calibration && req.body.date_calibration !== m.date_calibration) {
      await db.run(
        'INSERT INTO calibrations (machine_id, date, commentaire) VALUES (?, ?, ?)',
        [m.id, req.body.date_calibration, req.body.commentaire || 'calibration']
      );
    }
    await journal.enregistrer(req, 'modification machine', `machine ${m.id}`, nom);
    res.json(enrichirMachine({
      ...m, nom, type, statut_service: statut, date_calibration: cal, date_maintenance: maint
    }));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const machine = await db.get('SELECT id, nom FROM machines WHERE id = ?', [req.params.id]);
    if (!machine) return res.status(404).json({ erreur: "Cette machine n'existe pas." });
    const { n } = await db.get('SELECT COUNT(*) AS n FROM lots WHERE machine_id = ?', [req.params.id]);
    if (n > 0) {
      return res.status(409).json({
        erreur: `Impossible de supprimer : ${n} lot(s) sont encore rattachés à cette machine.`
      });
    }
    await db.run('DELETE FROM machines WHERE id = ?', [req.params.id]);
    await journal.enregistrer(req, 'suppression machine', `machine ${req.params.id}`, machine.nom);
    res.json({ message: 'Machine supprimée.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
