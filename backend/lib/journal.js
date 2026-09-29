async function enregistrer(req, action, cible, details) {
  try {
    const db = require('../db');
    const u = req && req.utilisateur;
    await db.run(
      `INSERT INTO journal_audit (utilisateur_id, nom_affiche, action, cible, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        u ? u.id : null,
        u ? u.nom : 'système',
        action,
        cible || '',
        details ? String(details).slice(0, 500) : ''
      ]
    );
  } catch {
    /* le journal ne doit pas faire échouer l'action métier */
  }
}

module.exports = { enregistrer };
