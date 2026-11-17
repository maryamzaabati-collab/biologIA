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
        titre: 'Qui peut voir quoi',
        resume: 'Chacun n’accède qu’à ce que son rôle autorise, et le serveur le vérifie à chaque requête : masquer un bouton ne suffirait pas.',
        detail: `Mots de passe chiffrés (scrypt), ${Number(sessions && sessions.n) || 0} session(s) ouverte(s), contrôle du rôle sur chaque route, jeton anti-falsification (CSRF), en-têtes de sécurité, réinitialisation de mot de passe, blocage après 5 échecs. Reste à faire : ${manquesAcces.join(' ; ')}.`,
        statut: 'partiel'
      },
      {
        code: 'rgpd',
        titre: 'Protection des patients',
        resume: identiteSeparee
          ? 'Les lots ne contiennent jamais de nom : chaque patient est remplacé par un code. Les identités sont rangées à part, visibles du seul biologiste.'
          : 'Les fichiers importés sont contrôlés, mais aucune identité n’est encore enregistrée.',
        detail: identiteSeparee
          ? 'Identités dans une table séparée ; lots et mesures ne portent que le code PSN. À l’import, les noms de colonnes et le contenu des cellules sont scannés pour repérer un nom, un NIR, un e-mail ou un téléphone oublié.'
          : 'Le scan des fichiers importés fonctionne ; la table d’identités est encore vide.',
        statut: identiteSeparee ? 'mis_en_place' : 'partiel'
      },
      {
        code: 'journal',
        titre: 'Historique infalsifiable',
        resume: Number(journal && journal.n)
          ? `Chaque action est enregistrée avec son auteur et sa date. ${hashOk ? 'Modifier une ligne après coup se verrait immédiatement.' : 'La protection contre la modification n’est pas active.'}`
          : 'Le journal est prêt, aucune action n’a encore été enregistrée.',
        detail: Number(journal && journal.n)
          ? `${journal.n} événements. Chaque ligne contient l’empreinte (SHA-256) de la précédente : les lignes forment une chaîne, et en casser un maillon se détecte. Validations signées au nom du biologiste.`
          : '',
        statut: Number(validations && validations.n) && hashOk ? 'mis_en_place' : 'partiel'
      },
      {
        code: 'iso',
        titre: 'Traçabilité (esprit ISO 15189)',
        resume: 'Rien ne s’efface : un lot retiré est archivé, il reste consultable. Une validation expire au bout de 12 mois et doit être refaite.',
        detail: 'Archivage au lieu de suppression, péremption des validations à 12 mois, certificat imprimable par lot. Démonstrateur pédagogique, pas une accréditation COFRAC.',
        statut: Number(lots && lots.n) ? 'partiel' : 'a_faire'
      },
      {
        code: 'ai_act',
        titre: 'Ce que le site ne fait pas',
        resume: 'Le site ne pose aucun diagnostic et ne remplace pas un biologiste : il signale, un humain décide.',
        detail: 'Les seuils d’alerte sont des exemples pédagogiques. Classification de risque au sens du règlement européen sur l’IA (AI Act) : à confirmer avec l’enseignant.',
        statut: 'partiel'
      },
      {
        code: 'anonymisation',
        titre: 'Impossible de retrouver quelqu’un',
        resume: kOk
          ? `Dans le jeu anonymisé, chaque profil est partagé par au moins ${dernierK} personnes : on ne peut désigner personne.`
          : (anon
            ? 'Certains profils sont trop rares dans le jeu anonymisé : une personne pourrait être reconnue. Relancez la génération.'
            : 'Aucun jeu anonymisé n’a encore été produit (onglet Patients).'),
        detail: kOk
          ? `${anon.nb_lignes} lignes produites. Le plus petit groupe (tranche d’âge + sexe + territoire) compte ${dernierK} personnes distinctes : c’est le k-anonymat, et le seuil retenu est 5.`
          : '',
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
