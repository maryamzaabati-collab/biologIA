const express = require('express');
const router = express.Router();
const db = require('../db');
const csrf = require('../lib/csrf');
const { limiter } = require('../lib/debit');

router.get('/', async (req, res) => {
  try {
    const sessions = await db.get('SELECT COUNT(*) AS n FROM sessions');
    const journal = await db.get('SELECT COUNT(*) AS n FROM journal_audit');
    const patients = await db.get('SELECT COUNT(*) AS n FROM patients_pseudo');
    const identiteSeparee = Number(patients && patients.n) > 0;
    const lots = await db.get('SELECT COUNT(*) AS n FROM lots WHERE COALESCE(archive, 0) = 0 AND COALESCE(est_test, 0) = 0');
    const validations = await db.get('SELECT COUNT(*) AS n FROM validations');
    const hashCol = await db.all("PRAGMA table_info(journal_audit)");
    const hashOk = hashCol.some((c) => c.name === 'hash');
    const csrfOk = Boolean(csrf && csrf.middleware);
    const debitOk = typeof limiter === 'function';
    const resetTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='reset_mdp'");
    const manquesAcces = [];
    if (!csrfOk) manquesAcces.push('jeton CSRF');
    if (!debitOk) manquesAcces.push('limitation de débit');
    if (!resetTable) manquesAcces.push('réinitialisation de mot de passe');
    manquesAcces.push('paquet Helmet (en-têtes manuels en place, non couverts par un test dédié)');
    manquesAcces.push('limitation HTTP globale (seule la connexion est limitée)');

    const anon = await db.get('SELECT k_min, nb_lignes, dernier_test FROM anonymisation_meta ORDER BY id DESC LIMIT 1');
    let dernierK = anon ? Number(anon.k_min) : null;
    if (anon && anon.dernier_test) {
      try {
        const t = JSON.parse(anon.dernier_test);
        if (t && t.k_min != null) dernierK = Number(t.k_min);
      } catch { /* ignore */ }
    }
    const kOk = dernierK != null && dernierK >= 5 && Number(anon && anon.nb_lignes) > 0;

    const items = [
      {
        code: 'acces',
        titre: 'Contrôle des accès',
        detail: `Présent : sessions (${Number(sessions && sessions.n) || 0}), rôles serveur, scrypt, CSRF, en-têtes (nosniff/frame/CSP), reset MDP, limite de connexion. Manque ou non testé : ${manquesAcces.join(' ; ')}.`,
        statut: 'partiel'
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
          ? `${journal.n} événements d’audit. Chaîne SHA-256 ${hashOk ? 'en place' : 'absente'}. Validations biologiste nominatives.`
          : 'Le journal est prêt, aucune action enregistrée pour l’instant.',
        statut: Number(validations && validations.n) && hashOk ? 'mis_en_place' : 'partiel'
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
        detail: 'Aucun diagnostic n’est posé. Les seuils d’alerte sont des exemples pédagogiques ; la décision finale reste humaine. Classification de risque : à confirmer avec l’enseignant.',
        statut: 'partiel'
      },
      {
        code: 'anonymisation',
        titre: 'Anonymisation (k ≥ 5)',
        detail: kOk
          ? `Dernier jeu / test : ${anon.nb_lignes} lignes, k minimum = ${dernierK}.`
          : (anon
            ? `Dernier k = ${dernierK}. Générez à nouveau ou relancez le test k ≥ 5.`
            : 'Aucun test k enregistré. Générez le jeu (onglet Patients) puis lancez le test.'),
        statut: kOk ? 'mis_en_place' : 'partiel'
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
