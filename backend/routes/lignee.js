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
        db.all('SELECT raison, date, mesures_json, regle_id FROM signalements WHERE lot_id = ? AND resolu = 0', [lot.id]),
        db.all('SELECT code_patient, COUNT(*) AS n FROM mesures_reference WHERE lot_id = ? GROUP BY code_patient', [lot.id])
      ]);
      const vu = libelleStatut(lot, validations, signalements.length);
      const nbMesures = mesures.reduce((t, m) => t + Number(m.n || 0), 0);
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
        alertes: signalements.map((s) => ({
          ...s,
          mesures: (() => { try { return s.mesures_json ? JSON.parse(s.mesures_json) : []; } catch { return []; } })()
        })),
        patients: mesures.map((m) => m.code_patient),
        etapes: [
          {
            type: 'patient',
            libelle: 'Patients',
            valeur: mesures.length ? `${mesures.length} patient${mesures.length > 1 ? 's' : ''}` : '—',
            auteur: Number(lot.anonymise) ? 'pseudonymisés (PSN)' : 'pseudonymisation à confirmer',
            date: lot.date,
            href: mesures.length ? `patients.html?onglet=identifiants&lot=${lot.id}` : null,
            reserve: 'patients',
            details: mesures.map((m) => m.code_patient)
          },
          {
            type: 'mesures',
            libelle: 'Mesures',
            valeur: nbMesures ? `${nbMesures} mesure${nbMesures > 1 ? 's' : ''}` : '—',
            auteur: mesures.length ? `${(nbMesures / mesures.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par patient` : '',
            date: lot.date,
            href: `lot.html?id=${lot.id}`
          },
          {
            type: 'lot',
            libelle: 'Lot',
            valeur: lot.code_verification || lot.nom,
            auteur: lot.nom,
            date: lot.date_creation,
            href: `lot.html?id=${lot.id}`
          },
          {
            type: 'machine',
            libelle: 'Machine',
            valeur: lot.machine_nom || 'n/r',
            href: lot.machine_id ? `machine.html?id=${lot.machine_id}` : 'machines.html'
          },
          {
            type: 'regle',
            libelle: 'Règle',
            valeur: regles[0] ? regles[0].parametre : 'Aucune',
            auteur: regles[0] && regles[0].statut === 'validee' ? 'seuils validés' : (regles[0] ? 'seuils' : '—')
          },
          {
            type: 'alerte',
            libelle: 'Alerte',
            valeur: signalements.length ? `${signalements.length} ouverte(s)` : 'Aucune',
            date: signalements[0] && signalements[0].date
          },
          {
            type: 'validation',
            libelle: 'Validation',
            valeur: validations[0] ? validations[0].nom_biologiste : 'en attente',
            date: validations[0] && validations[0].date_validation
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
