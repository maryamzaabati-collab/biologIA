const express = require('express');
const router = express.Router();
const db = require('../db');
const { testerAnonymisation, trancheAge, csvAvecBom } = require('../lib/tracabilite');

router.post('/tester', (req, res) => {
  try {
    const rapport = testerAnonymisation(req.body.csv_texte || '');
    res.json(rapport);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/export-anonyme', async (req, res) => {
  try {
    const lignes = await db.all(`
      SELECT patients_pseudo.code, patients_identite.sexe, patients_identite.departement,
        patients_identite.date_naissance
      FROM patients_pseudo JOIN patients_identite ON patients_identite.id = patients_pseudo.patient_id
    `);
    const csvLignes = [['code_patient', 'tranche_age', 'sexe', 'departement']];
    for (const l of lignes) {
      csvLignes.push([l.code, trancheAge(l.date_naissance) || '', l.sexe || '', l.departement || '']);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="patients-anonymises.csv"');
    res.send(csvAvecBom(csvLignes));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
