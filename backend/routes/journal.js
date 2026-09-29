const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    const lignes = await db.all(`
      SELECT * FROM journal_audit ORDER BY date DESC, id DESC LIMIT 200
    `);
    res.json(lignes);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
