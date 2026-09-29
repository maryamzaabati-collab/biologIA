const express = require('express');
const router = express.Router();
const db = require('../db');
const { testerValeur, libelleSeuils } = require('../lib/tracabilite');
const journal = require('../lib/journal');

router.get('/', async (req, res) => {
  try {
    const regles = await db.all(`
      SELECT regles_alerte.*, lots.nom AS lot_nom, lots.statut AS lot_statut,
        lots.code_verification AS lot_code
      FROM regles_alerte
      JOIN lots ON regles_alerte.lot_id = lots.id
      ORDER BY regles_alerte.parametre
    `);
    res.json(regles);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/lot/:lot_id', async (req, res) => {
  try {
    const lot = await db.get('SELECT id FROM lots WHERE id = ?', [req.params.lot_id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });
    const regles = await db.all(
      'SELECT * FROM regles_alerte WHERE lot_id = ? ORDER BY parametre',
      [req.params.lot_id]
    );
    res.json(regles);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/:id/tester', async (req, res) => {
  try {
    const regle = await db.get(
      `SELECT regles_alerte.*, lots.nom AS lot_nom, lots.id AS lot_id
       FROM regles_alerte JOIN lots ON lots.id = regles_alerte.lot_id
       WHERE regles_alerte.id = ?`,
      [req.params.id]
    );
    if (!regle) return res.status(404).json({ erreur: "Cette règle n'existe pas." });
    const test = testerValeur(regle, req.body.valeur);
    res.json({
      ...test,
      parametre: regle.parametre,
      lot_id: regle.lot_id,
      lot_nom: regle.lot_nom,
      seuil_bas: regle.seuil_bas,
      seuil_haut: regle.seuil_haut,
      unite: regle.unite
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  const { lot_id, parametre, seuil_bas, seuil_haut, unite } = req.body;
  if (!lot_id || !parametre || !unite) {
    return res.status(400).json({ erreur: 'lot_id, parametre et unite sont obligatoires.' });
  }
  try {
    const lot = await db.get('SELECT id FROM lots WHERE id = ?', [lot_id]);
    if (!lot) return res.status(404).json({ erreur: "Ce lot n'existe pas." });

    const { id } = await db.run(
      `INSERT INTO regles_alerte (lot_id, parametre, seuil_bas, seuil_haut, unite, statut)
       VALUES (?, ?, ?, ?, ?, 'a_valider')`,
      [lot_id, parametre, seuil_bas || null, seuil_haut || null, unite]
    );
    await journal.enregistrer(req, 'création règle', `lot ${lot_id}`, parametre);
    res.status(201).json({ id, lot_id, parametre, seuil_bas, seuil_haut, unite, statut: 'a_valider' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/:id/valider', async (req, res) => {
  try {
    const regle = await db.get('SELECT * FROM regles_alerte WHERE id = ?', [req.params.id]);
    if (!regle) return res.status(404).json({ erreur: "Cette règle n'existe pas." });
    const nom = req.utilisateur ? req.utilisateur.nom : '';
    await db.run(
      `UPDATE regles_alerte SET statut = 'validee', validee_par = ?, date_validation_regle = datetime('now')
       WHERE id = ?`,
      [nom, regle.id]
    );
    await journal.enregistrer(req, 'validation règle', `règle ${regle.id}`, regle.parametre);
    res.json({ message: 'Règle validée par un biologiste.', libelle: libelleSeuils(regle) });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const regle = await db.get('SELECT id FROM regles_alerte WHERE id = ?', [req.params.id]);
    if (!regle) return res.status(404).json({ erreur: "Cette règle n'existe pas." });
    await db.run('DELETE FROM regles_alerte WHERE id = ?', [req.params.id]);
    res.json({ message: 'Règle supprimée.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
