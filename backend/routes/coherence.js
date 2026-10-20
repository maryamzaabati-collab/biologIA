const express = require('express');
const router = express.Router();
const db = require('../db');
const { analyserLot, analyserTout } = require('../lib/coherence');

router.get('/', async (req, res) => {
  try {
    res.json(await analyserTout(db));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/lot/:id', async (req, res) => {
  try {
    const lot = await db.get('SELECT * FROM lots WHERE id = ?', [req.params.id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });
    res.json(await analyserLot(db, lot));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
