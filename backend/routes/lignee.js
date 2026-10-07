const express = require('express');
const router = express.Router();
const db = require('../db');
const { libelleStatut } = require('../lib/tracabilite');
const { formaterParis } = require('../lib/dates');

router.get('/', async (req, res) => {
  try {
    const lots = await db.all(`
      SELECT lots.id, lots.nom, lots.code_verification, lots.statut, lots.anonymise,
        lots.archive, lots.est_test, lots.machine_id, lots.date, lots.conditions, lots.alerte_identite,
        lots.modifie_apres_validation, lots.date_creation,
        machines.nom AS machine_nom
      FROM lots LEFT JOIN machines ON machines.id = lots.machine_id
      WHERE COALESCE(lots.archive, 0) = 0
      ORDER BY lots.id DESC
    `);
    const resultat = [];
    for (const lot of lots) {
      const [regles, validations, signalements, mesures] = await Promise.all([
        db.all('SELECT id, parametre, seuil_bas, seuil_haut, unite, statut, validee_par, date_validation_regle FROM regles_alerte WHERE lot_id = ?', [lot.id]),
        db.all('SELECT nom_biologiste, date_validation FROM validations WHERE lot_id = ? ORDER BY date_validation DESC', [lot.id]),
        db.all('SELECT raison, date FROM signalements WHERE lot_id = ? AND resolu = 0', [lot.id]),
        db.all('SELECT DISTINCT code_patient FROM mesures_reference WHERE lot_id = ? LIMIT 5', [lot.id])
      ]);
      const vu = libelleStatut(lot, validations, signalements.length);
      resultat.push({
        ...lot,
        machine: lot.machine_nom,
        statut_affiche: vu.code,
        statut_libelle: vu.libelle,
        regles,
        validations: validations.map((v) => ({
          ...v,
          date_paris: formaterParis(v.date_validation)
        })),
        alertes: signalements,
        patients: mesures.map((m) => m.code_patient),
        etapes: [
          {
            type: 'patient',
            libelle: 'Patient pseudonymisé',
            valeur: mesures[0] ? mesures[0].code_patient : (Number(lot.anonymise) ? 'Codes PSN du CSV' : 'non confirmé'),
            date: lot.date,
            href: mesures[0] ? `identifiants.html?q=${encodeURIComponent(mesures[0].code_patient)}` : 'identifiants.html',
            auteur: lot.conditions ? 'saisie lot' : null
          },
          {
            type: 'mesures',
            libelle: 'Mesures de référence',
            valeur: lot.nom,
            date: lot.date
          },
          {
            type: 'lot',
            libelle: 'Lot',
            valeur: lot.code_verification || lot.nom,
            date: lot.date_creation,
            href: `lot.html?id=${lot.id}`
          },
          {
            type: 'machine',
            libelle: 'Machine',
            valeur: lot.machine_nom || 'n/r',
            href: 'machines.html'
          },
          {
            type: 'regle',
            libelle: 'Règle',
            valeur: regles[0] ? regles[0].parametre : 'aucune'
          },
          {
            type: 'alerte',
            libelle: 'Alerte',
            valeur: signalements.length ? `${signalements.length} ouverte(s)` : 'aucune',
            date: signalements[0] && signalements[0].date
          },
          {
            type: 'validation',
            libelle: 'Validation',
            valeur: validations[0] ? validations[0].nom_biologiste : 'en attente',
            date: validations[0] && validations[0].date_validation,
            auteur: validations[0] && validations[0].nom_biologiste
          }
        ]
      });
    }
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
