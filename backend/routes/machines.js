const express = require('express');
const router = express.Router();
const db = require('../db');
const journal = require('../lib/journal');

router.get('/', async (req, res) => {
  try {
    const machines = await db.all(`
      SELECT machines.*,
        (SELECT MAX(lots.date) FROM lots WHERE lots.machine_id = machines.id) AS derniere_mesure,
        (SELECT COUNT(*) FROM lots WHERE lots.machine_id = machines.id AND COALESCE(lots.archive, 0) = 0) AS nb_lots
      FROM machines ORDER BY nom
    `);
    res.json(machines.map((m) => ({
      ...m,
      derniere_calibration: m.date_calibration || m.derniere_mesure,
      statut_service: m.statut_service || 'en_service'
    })));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  const { nom, type, date_calibration, statut_service } = req.body;
  if (!nom) return res.status(400).json({ erreur: 'Le nom de la machine est obligatoire.' });
  try {
    const { id } = await db.run(
      'INSERT INTO machines (nom, type, date_calibration, statut_service) VALUES (?, ?, ?, ?)',
      [nom, type || '', date_calibration || null, statut_service || 'en_service']
    );
    await journal.enregistrer(req, 'création machine', `machine ${id}`, nom);
    res.status(201).json({ id, nom, type });
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
