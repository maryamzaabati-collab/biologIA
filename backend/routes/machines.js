const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const machines = await db.all('SELECT * FROM machines ORDER BY nom');
    res.json(machines);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  const { nom, type } = req.body;
  if (!nom) return res.status(400).json({ erreur: 'Le nom de la machine est obligatoire.' });
  try {
    const { id } = await db.run('INSERT INTO machines (nom, type) VALUES (?, ?)', [nom, type || '']);
    res.status(201).json({ id, nom, type });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const machine = await db.get('SELECT id FROM machines WHERE id = ?', [req.params.id]);
    if (!machine) return res.status(404).json({ erreur: "Cette machine n'existe pas." });

    const { n } = await db.get('SELECT COUNT(*) AS n FROM lots WHERE machine_id = ?', [req.params.id]);
    if (n > 0) {
      return res.status(409).json({
        erreur: `Impossible de supprimer : ${n} lot(s) sont encore rattaches a cette machine.`
      });
    }

    await db.run('DELETE FROM machines WHERE id = ?', [req.params.id]);
    res.json({ message: 'Machine supprimee.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
