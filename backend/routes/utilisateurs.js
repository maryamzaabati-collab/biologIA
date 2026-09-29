const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const params = [];
    let sql = 'SELECT id, nom, role FROM utilisateurs';
    if (req.query.role) {
      sql += ' WHERE role = ?';
      params.push(req.query.role);
    }
    sql += ' ORDER BY nom';
    res.json(await db.all(sql, params));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
