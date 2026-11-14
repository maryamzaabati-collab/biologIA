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

async function jsonLot(req, res) {
  try {
    const lot = await db.get('SELECT * FROM lots WHERE id = ?', [req.params.id]);
    if (!lot) {
      return res.json({
        lot_id: req.params.id,
        anomalies: [],
        score_qualite: { completude: null, coherence: null, conformite: null, global: null },
        vide: true
      });
    }
    res.json(await analyserLot(db, lot));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
}

router.get('/lot/:id', jsonLot);
router.get('/lots/:id', jsonLot);
router.get('/:id', jsonLot);

module.exports = router;
