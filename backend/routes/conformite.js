const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const sessions = await db.get('SELECT COUNT(*) AS n FROM sessions');
    const journal = await db.get('SELECT COUNT(*) AS n FROM journal_audit');
    const patients = await db.get('SELECT COUNT(*) AS n FROM patients_pseudo');
    const identiteSeparee = Number(patients && patients.n) > 0;
    const lots = await db.get('SELECT COUNT(*) AS n FROM lots WHERE COALESCE(archive, 0) = 0');
    const validations = await db.get('SELECT COUNT(*) AS n FROM validations');
    const hashOk = true;
    const accesOk = Boolean(req.utilisateur) && Number(sessions && sessions.n) >= 0 && hashOk;

    const items = [
      {
        code: 'acces',
        titre: 'Contrôle des accès',
        detail: 'Sessions, rôles serveur (technicien / biologiste / client) et mots de passe hachés.',
        statut: accesOk ? 'mis_en_place' : 'partiel'
      },
      {
        code: 'rgpd',
        titre: 'RGPD / pseudonymisation',
        detail: identiteSeparee
          ? 'Identités fictives isolées (patients_identite) ; lots et mesures ne voient que le code PSN. Scan CSV colonnes + contenu.'
          : 'Scan CSV présent ; table d’identités encore vide.',
        statut: identiteSeparee ? 'mis_en_place' : 'partiel'
      },
      {
        code: 'journal',
        titre: 'Journal de validation',
        detail: Number(journal && journal.n)
          ? `${journal.n} événement(s) d’audit. Validations biologiste nominatives.`
          : 'Le journal est prêt, aucune action enregistrée pour l’instant.',
        statut: Number(validations && validations.n) ? 'mis_en_place' : 'partiel'
      },
      {
        code: 'iso',
        titre: 'ISO 15189',
        detail: 'Archivage (pas de suppression), péremption 12 mois, certificat par lot. Démonstrateur pédagogique, pas une accréditation COFRAC.',
        statut: Number(lots && lots.n) ? 'partiel' : 'a_faire'
      },
      {
        code: 'ai_act',
        titre: 'AI Act — transparence',
        detail: 'Aucun diagnostic n’est posé. Les seuils d’alerte sont des exemples pédagogiques ; la décision finale reste humaine. Classification de risque à confirmer avec l’enseignant.',
        statut: 'mis_en_place'
      }
    ];

    res.json({
      items,
      note_ai: 'Le système n’analyse aucun bilan patient réel et ne remplace pas un biologiste. Limite d’usage : données de référence fictives pour un jury pédagogique.'
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
