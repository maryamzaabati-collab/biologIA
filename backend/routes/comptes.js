const express = require('express');
const router = express.Router();
const db = require('../database');
const journal = require('../lib/journal');

const ROLES = ['client', 'technicien', 'biologiste'];

router.get('/', async (req, res) => {
  try {
    const statut = req.query.statut;
    const params = [];
    let sql = `SELECT id, nom, identifiant, email, role, role_demande, statut, google_id
               FROM utilisateurs`;
    if (statut) {
      sql += ' WHERE statut = ?';
      params.push(statut);
    }
    sql += " ORDER BY CASE statut WHEN 'en_attente' THEN 0 WHEN 'valide' THEN 1 ELSE 2 END, id DESC";
    res.json(await db.all(sql, params));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const action = req.body.action;
  const role = req.body.role;
  try {
    const user = await db.get('SELECT * FROM utilisateurs WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ erreur: "Ce compte n'existe pas." });
    if (action === 'refuser') {
      await db.run("UPDATE utilisateurs SET statut = 'refuse' WHERE id = ?", [user.id]);
      await journal.enregistrer(req, 'refus compte', `compte ${user.identifiant}`, user.nom);
      return res.json({ message: 'Compte refusé.' });
    }
    if (action === 'suspendre') {
      await db.run("UPDATE utilisateurs SET statut = 'refuse' WHERE id = ?", [user.id]);
      await journal.enregistrer(req, 'suspension compte', `compte ${user.identifiant}`, user.nom);
      return res.json({ message: 'Compte suspendu.' });
    }
    if (action === 'role') {
      if (!ROLES.includes(role)) return res.status(400).json({ erreur: 'Rôle inconnu.' });
      await db.run('UPDATE utilisateurs SET role = ? WHERE id = ?', [role, user.id]);
      await journal.enregistrer(req, 'changement rôle', `compte ${user.identifiant}`, role);
      return res.json({ message: 'Rôle mis à jour.', role });
    }
    if (action === 'valider') {
      const roleFinal = ROLES.includes(role) ? role : (user.role_demande || user.role);
      if (!ROLES.includes(roleFinal)) {
        return res.status(400).json({ erreur: 'Indiquez le rôle accordé.' });
      }
      await db.run(
        "UPDATE utilisateurs SET statut = 'valide', role = ? WHERE id = ?",
        [roleFinal, user.id]
      );
      await journal.enregistrer(req, 'accord compte', `compte ${user.identifiant}`, roleFinal);
      return res.json({ message: 'Compte validé.', role: roleFinal });
    }
    res.status(400).json({ erreur: 'Action inconnue.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
