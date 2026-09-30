const express = require('express');
const router = express.Router();
const db = require('../database');
const { formaterParis, isoUtc } = require('../lib/dates');

router.get('/', async (req, res) => {
  try {
    const lignes = await db.all(`
      SELECT * FROM journal_audit ORDER BY date DESC, id DESC LIMIT 200
    `);
    res.json(lignes.map((l) => ({
      ...l,
      date: isoUtc(l.date),
      date_paris: formaterParis(l.date)
    })));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
