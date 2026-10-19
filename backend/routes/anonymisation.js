const express = require('express');
const router = express.Router();
const db = require('../db');
const journal = require('../lib/journal');
const { csvAvecBom } = require('../lib/tracabilite');
const { genererJeu, csvDuJeu, enrichirRapport, csvPiege } = require('../lib/anonymiser');

async function identites() {
  return db.all('SELECT nom, prenom, date_naissance, sexe, departement, code_postal FROM patients_identite');
}

router.post('/generer', async (req, res) => {
  try {
    if (!req.utilisateur || req.utilisateur.role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seul un biologiste génère le jeu anonymisé.' });
    }
    const brutes = await db.all(`
      SELECT patients_identite.date_naissance, patients_identite.sexe, patients_identite.departement,
        patients_identite.code_postal, mesures_reference.parametre, mesures_reference.valeur,
        mesures_reference.unite, mesures_reference.date
      FROM mesures_reference
      JOIN patients_pseudo ON upper(COALESCE(patients_pseudo.psn, patients_pseudo.code)) = upper(mesures_reference.code_patient)
      JOIN patients_identite ON patients_identite.id = COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id)
    `);
    const jeu = genererJeu(brutes);
    await db.run('DELETE FROM donnees_anonymisees');
    for (const l of jeu.lignes) {
      await db.run(
        `INSERT INTO donnees_anonymisees (tranche_age, sexe, territoire, parametre, valeur, unite, mois)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [l.tranche_age, l.sexe, l.territoire, l.parametre, l.valeur, l.unite, l.mois]
      );
    }
    await db.run('DELETE FROM anonymisation_meta');
    await db.run(
      `INSERT INTO anonymisation_meta (genere_le, genere_par, nb_lignes, generalisees, supprimees, k_min)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        require('../lib/dates').horlogeParis(),
        req.utilisateur.nom,
        jeu.nb_lignes,
        jeu.generalisees,
        jeu.supprimees,
        jeu.k_min
      ]
    );
    await journal.enregistrer(req, 'génération jeu anonymisé', 'donnees_anonymisees',
      `${jeu.nb_lignes} lignes, ${jeu.generalisees} généralisées, ${jeu.supprimees} supprimées, k=${jeu.k_min}`);
    res.json({
      ok: true,
      nb_lignes: jeu.nb_lignes,
      generalisees: jeu.generalisees,
      supprimees: jeu.supprimees,
      k_min: jeu.k_min
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/statut', async (req, res) => {
  try {
    const meta = await db.get('SELECT * FROM anonymisation_meta ORDER BY id DESC LIMIT 1');
    const n = await db.get('SELECT COUNT(*) AS n FROM donnees_anonymisees');
    res.json({
      genere: Boolean(meta),
      meta: meta || null,
      nb_lignes: Number(n && n.n) || 0
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/tester', async (req, res) => {
  try {
    const source = String(req.body.source || 'csv');
    let texte = String(req.body.csv_texte || '');
    if (source === 'propre') {
      const lignes = await db.all('SELECT * FROM donnees_anonymisees');
      if (!lignes.length) {
        return res.status(400).json({ erreur: 'Générez d’abord le jeu anonymisé.' });
      }
      texte = csvDuJeu(lignes).texte;
    } else if (source === 'piege') {
      texte = csvPiege();
    }
    const rapport = enrichirRapport(texte, await identites());
    await journal.enregistrer(req, 'test anonymisation', source, rapport.ok ? 'OK' : 'KO');
    res.json({ ...rapport, source, csv_texte: source === 'csv' ? undefined : texte });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/export-anonyme', async (req, res) => {
  try {
    const lignes = await db.all('SELECT tranche_age, sexe, territoire, parametre, valeur, unite, mois FROM donnees_anonymisees');
    const csvLignes = [['tranche_age', 'sexe', 'territoire', 'parametre', 'valeur', 'unite', 'mois']];
    for (const l of lignes) {
      csvLignes.push([l.tranche_age, l.sexe, l.territoire, l.parametre, l.valeur, l.unite, l.mois]);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="jeu-anonymise.csv"');
    res.send(csvAvecBom(csvLignes));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
