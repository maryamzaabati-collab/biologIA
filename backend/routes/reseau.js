// Observatoire du réseau : vue d'ensemble des 12 laboratoires, de leurs
// analyseurs, de la qualité de leurs mesures et des lots de référence.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { csvAvecBom } = require('../lib/tracabilite');

const SOURCES = [
  { libelle: 'Nombre d’actes et montants remboursés en France (janvier–juin 2026, 14 codes NABM)', origine: 'Assurance Maladie (Cnam), séries mensuelles « biologie médicale 2026 »', type: 'réel' },
  { libelle: 'Villes, codes INSEE et populations municipales', origine: 'Référentiel @etalab/decoupage-administratif 6.0.0 (INSEE)', type: 'réel' },
  { libelle: 'Contours des départements de la région Sud', origine: 'france-geojson (d’après IGN Admin Express), version simplifiée', type: 'réel' },
  { libelle: 'Erreurs totales admissibles (ETa) et imprécisions cibles', origine: 'Ordres de grandeur inspirés de CLIA 2024 et de la base EFLM de variation biologique', type: 'référentiel' },
  { libelle: 'Sites du réseau, analyseurs, contrôles qualité (2025–2026), campagnes inter-laboratoires, lots de référence, résultats patients pseudonymisés', origine: 'Simulation déterministe (graine fixe) calée sur les volumes réels — aucun vrai laboratoire, aucun vrai patient', type: 'simulé' }
];

function nb(v) { return Number(v) || 0; }
function arr(v, n = 1) { const p = 10 ** n; return Math.round(v * p) / p; }

async function analytes() {
  const liste = await db.all('SELECT * FROM reseau_analytes ORDER BY actes_s1_2026 DESC');
  return Object.fromEntries(liste.map((a) => [a.code, a]));
}

async function sites() {
  return db.all("SELECT * FROM reseau_sites ORDER BY CASE type WHEN 'plateau' THEN 0 ELSE 1 END, population DESC");
}

// Volume quotidien moyen (jours ouvrés) d'un analyte analysé sur un site.
async function volumeQuotidien(site, analyte) {
  const r = await db.get(
    `SELECT SUM(nb_examens) AS n, COUNT(DISTINCT mois) AS m FROM reseau_activite
     WHERE site_analyse = ? AND analyte = ?`, [site, analyte]
  );
  const mois = nb(r && r.m) || 1;
  return nb(r && r.n) / mois / 26;
}

// Performance de chaque couple analyseur × analyte : imprécision, biais, Sigma.
async function performances() {
  const A = await analytes();
  const stats = await db.all(`
    SELECT analyseur, analyte, niveau, COUNT(*) AS n, AVG(valeur) AS moy,
      AVG(valeur * valeur) AS moy2, SUM(rejet) AS rejets
    FROM reseau_qc WHERE pendant_incident = 0
    GROUP BY analyseur, analyte, niveau`);
  const biais = await db.all(`
    SELECT analyseur, analyte, AVG((valeur - cible) / cible * 100.0) AS biais, AVG(ABS(z)) AS z_abs, MAX(ABS(z)) AS z_max
    FROM reseau_eeq GROUP BY analyseur, analyte`);
  const apps = await db.all(`SELECT reseau_analyseurs.*, reseau_sites.ville, reseau_sites.nom AS site_nom
    FROM reseau_analyseurs JOIN reseau_sites ON reseau_sites.code = reseau_analyseurs.site`);
  const parCle = {};
  for (const s of stats) {
    const cle = `${s.analyseur}|${s.analyte}`;
    const variance = Math.max(0, s.moy2 - s.moy * s.moy);
    const cv = s.moy ? Math.sqrt(variance * s.n / Math.max(1, s.n - 1)) / s.moy * 100 : 0;
    parCle[cle] = parCle[cle] || { cvs: [], n: 0, rejets: 0 };
    parCle[cle].cvs.push(cv);
    parCle[cle].n += nb(s.n);
    parCle[cle].rejets += nb(s.rejets);
  }
  const lignes = [];
  for (const app of apps) {
    for (const code of String(app.analytes).split(',')) {
      const p = parCle[`${app.code}|${code}`];
      if (!p) continue;
      const a = A[code];
      const cv = p.cvs.reduce((s, x) => s + x, 0) / p.cvs.length;
      const b = biais.find((x) => x.analyseur === app.code && x.analyte === code) || {};
      const biaisPct = nb(b.biais);
      const sigma = (a.eta - Math.abs(biaisPct)) / cv;
      lignes.push({
        analyseur: app.code,
        analyseur_nom: app.nom,
        machine_id: app.machine_id,
        site: app.site,
        ville: app.ville,
        discipline: app.discipline,
        analyte: code,
        analyte_libelle: a.libelle,
        unite: a.unite,
        nb_controles: p.n,
        taux_rejet: arr(100 * p.rejets / Math.max(1, p.n), 1),
        cv: arr(cv, 2),
        cv_cible: a.cv_cible,
        biais: arr(biaisPct, 2),
        eta: a.eta,
        eeq_z_moyen: arr(nb(b.z_abs), 2),
        eeq_z_max: arr(nb(b.z_max), 2),
        sigma: arr(sigma, 1),
        ...strategie(sigma)
      });
    }
  }
  return lignes;
}

// Recommandation de contrôle selon le Sigma (approche « Westgard Sigma Rules »).
function strategie(sigma) {
  if (sigma >= 6) return { niveau_sigma: 'classe mondiale', regles_conseillees: '1-3s', frequence: '2 niveaux, 1 fois par jour', couleur: 'ok' };
  if (sigma >= 5) return { niveau_sigma: 'excellent', regles_conseillees: '1-3s · 2-2s · R-4s', frequence: '2 niveaux, 1 fois par jour', couleur: 'ok' };
  if (sigma >= 4) return { niveau_sigma: 'bon', regles_conseillees: '1-3s · 2-2s · R-4s · 4-1s', frequence: '2 niveaux, 2 fois par jour', couleur: 'wait' };
  if (sigma >= 3) return { niveau_sigma: 'à surveiller', regles_conseillees: 'multirègles complètes (dont 10x)', frequence: '2 niveaux, 3 fois par jour', couleur: 'wait' };
  return { niveau_sigma: 'insuffisant', regles_conseillees: 'multirègles + revue de la méthode', frequence: 'contrôle à chaque série', couleur: 'flag' };
}

async function derivesDetaillees() {
  const A = await analytes();
  const liste = await db.all(`SELECT reseau_derives.*, reseau_analyseurs.nom AS analyseur_nom, reseau_sites.ville, reseau_sites.nom AS site_nom
    FROM reseau_derives
    JOIN reseau_analyseurs ON reseau_analyseurs.code = reseau_derives.analyseur
    JOIN reseau_sites ON reseau_sites.code = reseau_derives.site
    ORDER BY debut`);
  const sortie = [];
  for (const d of liste) {
    const vq = await volumeQuotidien(d.site, d.analyte);
    const joursAvec = Math.max(1, Math.round((Date.parse(d.correction) - Date.parse(d.debut)) / 86400000));
    const joursSans = Math.max(1, Math.round((Date.parse(d.revue_mensuelle) - Date.parse(d.debut)) / 86400000) + 1);
    const ouvres = (j) => Math.round(j * 6 / 7);
    const lots = await db.all('SELECT nom, statut, periode_debut, periode_fin, nb_resultats FROM reseau_lots WHERE derive_liee = ?', [`${d.analyseur}|${d.analyte}`]);
    sortie.push({
      ...d,
      analyte_libelle: A[d.analyte] ? A[d.analyte].libelle : d.analyte,
      delai_detection_jours: Math.round((Date.parse(d.detection) - Date.parse(d.debut)) / 86400000),
      jours_exposition_avec: joursAvec,
      jours_exposition_sans: joursSans,
      jours_gagnes: Math.max(0, joursSans - joursAvec),
      resultats_exposes_avec: Math.round(vq * ouvres(joursAvec)) || Math.round(vq),
      resultats_exposes_sans: Math.round(vq * ouvres(joursSans)),
      lots_impactes: lots
    });
  }
  return sortie;
}

router.get('/resume', async (req, res) => {
  try {
    const [s, apps, qc, act, lots, derives, perf, eeq] = await Promise.all([
      sites(),
      db.get('SELECT COUNT(*) AS n FROM reseau_analyseurs'),
      db.get('SELECT COUNT(*) AS n, SUM(rejet) AS rejets, SUM(CASE WHEN regle = \'1-2s\' THEN 1 ELSE 0 END) AS avert FROM reseau_qc'),
      db.all(`SELECT mois, SUM(nb_examens) AS n, SUM(nb_examens * 1.0 * a.montant_s1_2026 / a.actes_s1_2026) AS euros
        FROM reseau_activite JOIN reseau_analytes a ON a.code = reseau_activite.analyte GROUP BY mois ORDER BY mois`),
      db.all('SELECT statut, COUNT(*) AS n FROM reseau_lots GROUP BY statut'),
      derivesDetaillees(),
      performances(),
      db.get('SELECT COUNT(*) AS n, SUM(CASE WHEN ABS(z) > 2 THEN 1 ELSE 0 END) AS hors FROM reseau_eeq')
    ]);
    const totalExamens = act.reduce((t, m) => t + nb(m.n), 0);
    const resultats = await db.get('SELECT COUNT(*) AS n FROM reseau_resultats');
    const nbAnalyses = await db.get('SELECT COUNT(*) AS n, SUM(controle_qualite) AS qc FROM reseau_analytes');
    const sigmas = perf.map((p) => p.sigma).sort((a, b) => a - b);
    const statLots = Object.fromEntries(lots.map((l) => [l.statut, nb(l.n)]));
    const population = s.reduce((t, x) => t + nb(x.population), 0);
    res.json({
      sites: s.length,
      plateaux: s.filter((x) => x.type === 'plateau').length,
      population_communes: population,
      analyseurs: nb(apps.n),
      couples_suivis: perf.length,
      controles_qc: nb(qc.n),
      runs_rejetes: Math.round(nb(qc.rejets) / 2),
      taux_rejet: arr(100 * nb(qc.rejets) / Math.max(1, nb(qc.n)), 1),
      periode: { debut: act.length ? act[0].mois : null, fin: act.length ? act[act.length - 1].mois : null, mois: act.length },
      examens_total: totalExamens,
      examens_2026: act.filter((m) => m.mois.startsWith('2026')).reduce((t, m) => t + nb(m.n), 0),
      depense_remboursee_estimee: Math.round(act.reduce((t, m) => t + nb(m.euros), 0)),
      examens_par_mois: act.map((m) => ({ mois: m.mois, n: nb(m.n) })),
      analyses: nb(nbAnalyses.n),
      analyses_controlees: nb(nbAnalyses.qc),
      resultats_pseudonymises: nb(resultats.n),
      lots: { total: Object.values(statLots).reduce((a, b) => a + b, 0), ...statLots },
      derives: derives.length,
      delai_moyen_detection: derives.length ? arr(derives.reduce((t, d) => t + d.delai_detection_jours, 0) / derives.length, 1) : 0,
      jours_gagnes: derives.reduce((t, d) => t + d.jours_gagnes, 0),
      resultats_exposes_avec: derives.reduce((t, d) => t + d.resultats_exposes_avec, 0),
      resultats_exposes_sans: derives.reduce((t, d) => t + d.resultats_exposes_sans, 0),
      sigma_median: sigmas.length ? sigmas[Math.floor(sigmas.length / 2)] : null,
      couples_sigma_faible: perf.filter((p) => p.sigma < 4).length,
      eeq_resultats: nb(eeq.n),
      eeq_hors_limites: nb(eeq.hors),
      sources: SOURCES
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/sites', async (req, res) => {
  try {
    const [liste, perf, act, lots, derives] = await Promise.all([
      sites(),
      performances(),
      db.all('SELECT site, SUM(nb_examens) AS n FROM reseau_activite GROUP BY site'),
      db.all('SELECT site, statut, COUNT(*) AS n FROM reseau_lots GROUP BY site, statut'),
      db.all('SELECT site, COUNT(*) AS n FROM reseau_derives GROUP BY site')
    ]);
    const sortie = liste.map((s) => {
      const p = perf.filter((x) => x.site === s.code);
      const sigmaMoy = p.length ? p.reduce((t, x) => t + Math.min(x.sigma, 10), 0) / p.length : 0;
      const zMoy = p.length ? p.reduce((t, x) => t + x.eeq_z_moyen, 0) / p.length : 0;
      const rejet = p.length ? p.reduce((t, x) => t + x.taux_rejet, 0) / p.length : 0;
      const aRevalider = nb((lots.find((l) => l.site === s.code && l.statut === 'a_revalider') || {}).n);
      const aValider = nb((lots.find((l) => l.site === s.code && l.statut === 'a_valider') || {}).n);
      const nbDerives = nb((derives.find((d) => d.site === s.code) || {}).n);
      // Indice qualité : 50 % Sigma, 30 % concordance inter-labos, 20 % lots à jour
      const score = Math.round(
        50 * Math.min(1, sigmaMoy / 6)
        + 30 * Math.max(0, 1 - zMoy / 1.5)
        + 20 * (aRevalider ? 0.3 : aValider ? 0.8 : 1)
      );
      return {
        ...s,
        examens_total: nb((act.find((a) => a.site === s.code) || {}).n),
        analyseurs: new Set(p.map((x) => x.analyseur)).size,
        analytes: p.length,
        sigma_moyen: arr(sigmaMoy, 1),
        sigma_min: p.length ? Math.min(...p.map((x) => x.sigma)) : null,
        eeq_z_moyen: arr(zMoy, 2),
        taux_rejet: arr(rejet, 1),
        lots_a_revalider: aRevalider,
        lots_a_valider: aValider,
        derives: nbDerives,
        indice_qualite: score,
        etat: (p.length && Math.min(...p.map((x) => x.sigma)) < 2) || score < 65
          ? 'alerte'
          : (aRevalider || score < 78 ? 'surveiller' : 'ok')
      };
    });
    res.json(sortie);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/repartition', async (req, res) => {
  try {
    const A = await analytes();
    const [parAnalyte, parDep, parMois, flux, parDisc] = await Promise.all([
      db.all("SELECT analyte, SUM(nb_examens) AS n FROM reseau_activite WHERE mois LIKE '2026%' GROUP BY analyte ORDER BY n DESC"),
      db.all(`SELECT reseau_sites.departement AS dep, SUM(nb_examens) AS n, SUM(DISTINCT 0) AS z
        FROM reseau_activite JOIN reseau_sites ON reseau_sites.code = reseau_activite.site GROUP BY dep ORDER BY n DESC`),
      db.all(`SELECT mois, analyte, SUM(nb_examens) AS n FROM reseau_activite GROUP BY mois, analyte ORDER BY mois`),
      db.all(`SELECT site, site_analyse, SUM(nb_examens) AS n FROM reseau_activite WHERE site <> site_analyse GROUP BY site, site_analyse ORDER BY n DESC`),
      db.all(`SELECT reseau_analytes.discipline AS discipline, SUM(nb_examens) AS n FROM reseau_activite
        JOIN reseau_analytes ON reseau_analytes.code = reseau_activite.analyte GROUP BY discipline ORDER BY n DESC`)
    ]);
    const totalReseau = parAnalyte.reduce((t, x) => t + nb(x.n), 0);
    const totalNational = Object.values(A).reduce((t, a) => t + nb(a.actes_s1_2026), 0);
    res.json({
      par_analyte: parAnalyte.map((x) => ({
        analyte: x.analyte,
        libelle: A[x.analyte].libelle,
        nabm: A[x.analyte].code_nabm,
        examens: nb(x.n),
        part_reseau: arr(100 * nb(x.n) / totalReseau, 1),
        actes_nationaux_s1_2026: A[x.analyte].actes_s1_2026,
        montant_national_s1_2026: A[x.analyte].montant_s1_2026,
        euros_par_acte: arr(A[x.analyte].montant_s1_2026 / A[x.analyte].actes_s1_2026, 2),
        part_nationale: arr(100 * A[x.analyte].actes_s1_2026 / totalNational, 1)
      })),
      par_departement: parDep.map((x) => ({ departement: x.dep, examens: nb(x.n) })),
      par_discipline: parDisc.map((x) => ({ discipline: x.discipline, examens: nb(x.n) })),
      par_mois: parMois,
      examens_2026: totalReseau,
      flux_vers_plateaux: flux.map((x) => ({ depuis: x.site, vers: x.site_analyse, examens: nb(x.n) }))
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/performance', async (req, res) => {
  try {
    let p = await performances();
    if (req.query.site) p = p.filter((x) => x.site === req.query.site);
    if (req.query.analyte) p = p.filter((x) => x.analyte === req.query.analyte);
    p.sort((a, b) => a.sigma - b.sigma);
    res.json(p);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/derives', async (req, res) => {
  try {
    res.json(await derivesDetaillees());
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/qc', async (req, res) => {
  try {
    const { analyseur, analyte } = req.query;
    if (!analyseur || !analyte) return res.status(400).json({ erreur: 'Analyseur et analyte obligatoires.' });
    const debut = req.query.debut || '2026-01-01';
    const fin = req.query.fin || '2026-12-31';
    const points = await db.all(
      `SELECT date, niveau, valeur, cible, ecart_type, z, regle, rejet, pendant_incident FROM reseau_qc
       WHERE analyseur = ? AND analyte = ? AND date BETWEEN ? AND ? ORDER BY date, niveau`,
      [analyseur, analyte, debut, fin]
    );
    const derive = await db.get('SELECT * FROM reseau_derives WHERE analyseur = ? AND analyte = ?', [analyseur, analyte]);
    res.json({ points, derive: derive || null });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/eeq', async (req, res) => {
  try {
    const analyte = req.query.analyte || 'CREA';
    const lignes = await db.all(
      `SELECT reseau_eeq.*, reseau_sites.ville FROM reseau_eeq
       JOIN reseau_sites ON reseau_sites.code = reseau_eeq.site
       WHERE analyte = ? ORDER BY CASE reseau_sites.type WHEN 'plateau' THEN 0 ELSE 1 END, reseau_sites.population DESC, campagne`, [analyte]
    );
    res.json(lignes);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/lots', async (req, res) => {
  try {
    const where = [];
    const params = [];
    for (const champ of ['site', 'analyte', 'statut']) {
      if (req.query[champ]) { where.push(`reseau_lots.${champ} = ?`); params.push(req.query[champ]); }
    }
    const lignes = await db.all(
      `SELECT reseau_lots.*, reseau_sites.ville, reseau_analyseurs.nom AS analyseur_nom, reseau_analytes.unite, reseau_analytes.libelle AS analyte_libelle
       FROM reseau_lots
       JOIN reseau_sites ON reseau_sites.code = reseau_lots.site
       JOIN reseau_analyseurs ON reseau_analyseurs.code = reseau_lots.analyseur
       JOIN reseau_analytes ON reseau_analytes.code = reseau_lots.analyte
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY CASE reseau_lots.statut WHEN 'a_revalider' THEN 0 WHEN 'a_valider' THEN 1 ELSE 2 END, periode_debut DESC, reseau_lots.nom`,
      params
    );
    res.json(lignes);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// Échantillon de résultats patients pseudonymisés : distribution, seuils, k-anonymat.
router.get('/resultats', async (req, res) => {
  try {
    const A = await analytes();
    const code = A[req.query.analyte] ? req.query.analyte : 'CRP';
    const a = A[code];
    const filtreSite = req.query.site ? ' AND site = ?' : '';
    const params = req.query.site ? [code, req.query.site] : [code];
    const valeurs = (await db.all(`SELECT valeur FROM reseau_resultats WHERE analyte = ?${filtreSite} ORDER BY valeur`, params)).map((r) => r.valeur);
    const parInterp = await db.all(`SELECT interpretation, COUNT(*) AS n FROM reseau_resultats WHERE analyte = ?${filtreSite} GROUP BY interpretation`, params);
    const parGroupe = await db.all(`SELECT sexe, classe_age, COUNT(*) AS n, AVG(valeur) AS moyenne,
        SUM(CASE WHEN interpretation <> 'normal' THEN 1 ELSE 0 END) AS hors
      FROM reseau_resultats WHERE analyte = ?${filtreSite} GROUP BY sexe, classe_age ORDER BY sexe, classe_age`, params);
    // k-anonymat : chaque combinaison (lieu, sexe, tranche d'âge) doit regrouper au moins 5 patients.
    const kAnon = await db.get(`SELECT MIN(n) AS k, COUNT(*) AS groupes, SUM(CASE WHEN n < 5 THEN 1 ELSE 0 END) AS petits FROM (
      SELECT COUNT(DISTINCT pseudo) AS n FROM reseau_resultats GROUP BY site, sexe, classe_age)`);
    const petits = await db.all(`SELECT site, sexe, classe_age, COUNT(DISTINCT pseudo) AS n FROM reseau_resultats
      GROUP BY site, sexe, classe_age HAVING n < 5`);
    // Généralisation : on remplace la ville par le département pour les partages.
    const kDep = await db.get(`SELECT MIN(n) AS k, COUNT(*) AS groupes FROM (
      SELECT COUNT(DISTINCT pseudo) AS n FROM reseau_resultats r JOIN reseau_sites s ON s.code = r.site
      GROUP BY s.departement, sexe, classe_age)`);
    const total = await db.get('SELECT COUNT(*) AS n, COUNT(DISTINCT pseudo) AS p FROM reseau_resultats');
    // histogramme sur 24 classes entre le 1er et le 99e percentile
    const q = (p) => valeurs.length ? valeurs[Math.min(valeurs.length - 1, Math.floor(p * valeurs.length))] : 0;
    const min = q(0.005);
    const max = q(0.99);
    const pas = (max - min) / 24 || 1;
    const classes = Array.from({ length: 24 }, (_, i) => ({ de: arr(min + i * pas, 3), a: arr(min + (i + 1) * pas, 3), n: 0 }));
    for (const v of valeurs) {
      if (v < min || v > max) continue;
      classes[Math.min(23, Math.floor((v - min) / pas))].n++;
    }
    const n = valeurs.length;
    res.json({
      analyte: code,
      libelle: a.libelle,
      unite: a.unite,
      ref_bas: a.ref_bas,
      ref_haut: a.ref_haut,
      n,
      mediane: q(0.5),
      p025: q(0.025),
      p975: q(0.975),
      interpretation: Object.fromEntries(parInterp.map((x) => [x.interpretation, nb(x.n)])),
      classes,
      par_groupe: parGroupe.map((g) => ({ ...g, moyenne: arr(g.moyenne, 2), part_hors: arr(100 * g.hors / g.n, 1) })),
      k_anonymat: {
        regle: 5,
        par_ville: { k_min: nb(kAnon.k), groupes: nb(kAnon.groupes), groupes_trop_petits: nb(kAnon.petits), exemples: petits.slice(0, 5) },
        par_departement: { k_min: nb(kDep.k), groupes: nb(kDep.groupes) },
        respecte: nb(kDep.k) >= 5
      },
      total_resultats: nb(total.n),
      patients_pseudonymises: nb(total.p)
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

const DICTIONNAIRE = {
  sites: { table: 'reseau_sites', description: 'Les 20 laboratoires du réseau (simulés, implantés dans de vraies communes).', colonnes: {
    code: 'Code court du site', nom: 'Nom du laboratoire', ville: 'Commune', code_insee: 'Code officiel de la commune (INSEE)', departement: 'Département',
    population: 'Population municipale de la commune (INSEE, réelle)', lat: 'Latitude', lon: 'Longitude', type: 'plateau (gros plateau technique) ou proximite (site de proximité)',
    plateau: 'Plateau qui reçoit les analyses spécialisées du site', accredite_depuis: 'Date d’accréditation ISO 15189 (simulée)', responsable: 'Biologiste responsable' } },
  analytes: { table: 'reseau_analytes', description: 'Les 14 analyses suivies, avec leur volume et leur coût national réels.', colonnes: {
    code: 'Code court', libelle: 'Nom de l’analyse', unite: 'Unité', code_nabm: 'Code de la nomenclature des actes de biologie médicale', libelle_nabm: 'Libellé NABM',
    actes_s1_2026: 'Actes remboursés en France de janvier à juin 2026 (Cnam, réel)', montant_s1_2026: 'Montant remboursé en France de janvier à juin 2026, en euros (Cnam, réel)',
    controle_qualite: '1 si l’analyse a des contrôles qualité chiffrés dans la simulation', cible_n1: 'Valeur cible du contrôle niveau bas', cible_n2: 'Valeur cible du contrôle niveau haut',
    cv_cible: 'Imprécision visée (%)', eta: 'Erreur totale admissible (%)', discipline: 'Discipline', ref_bas: 'Limite basse usuelle', ref_haut: 'Limite haute usuelle' } },
  analyseurs: { table: 'reseau_analyseurs', description: 'Les automates de chaque site.', colonnes: {
    code: 'Code (site-discipline)', site: 'Site', nom: 'Nom affiché', modele: 'Modèle', fabricant: 'Fabricant', discipline: 'Discipline', analytes: 'Analyses réalisées', machine_id: 'Lien vers la machine du registre (Nice)' } },
  qc: { table: 'reseau_qc', description: 'Contrôles qualité internes : 2 niveaux par jour ouvré et par analyse.', colonnes: {
    analyseur: 'Analyseur', analyte: 'Analyse', niveau: 'N1 (bas) ou N2 (haut)', date: 'Jour', valeur: 'Valeur mesurée', cible: 'Valeur attendue',
    ecart_type: 'Écart-type de référence', z: 'Écart à la cible en nombre d’écarts-types', regle: 'Règle(s) de Westgard déclenchée(s)', rejet: '1 si la série est rejetée', pendant_incident: '1 si une dérive simulée était en cours' } },
  derives: { table: 'reseau_derives', description: 'Dérives détectées par les règles de Westgard.', colonnes: {
    analyseur: 'Analyseur', site: 'Site', analyte: 'Analyse', type: 'decalage, tendance ou imprecision', debut: 'Début réel de la dérive', premiere_alerte: 'Premier avertissement 1-2s',
    detection: 'Rejet par une règle de Westgard', regles: 'Règles déclenchées', revue_mensuelle: 'Date où une revue mensuelle l’aurait vue', correction: 'Retour à la normale', cause: 'Cause', action: 'Action corrective' } },
  activite: { table: 'reseau_activite', description: 'Nombre d’examens par mois, site de prélèvement et site d’analyse.', colonnes: {
    site: 'Site de prélèvement', site_analyse: 'Site où l’analyse est faite', mois: 'Mois', analyte: 'Analyse', nb_examens: 'Nombre d’examens' } },
  eeq: { table: 'reseau_eeq', description: 'Évaluation externe de la qualité : chaque mois, le même échantillon est mesuré par tous les sites.', colonnes: {
    site: 'Site', analyseur: 'Analyseur', analyte: 'Analyse', campagne: 'Mois de la campagne', valeur: 'Valeur rendue', cible: 'Valeur de consensus', sd_groupe: 'Écart-type du groupe', z: 'z-score (|z| > 2 : à surveiller, > 3 : non conforme)' } },
  lots: { table: 'reseau_lots', description: 'Lots de référence trimestriels qui servent à fixer les seuils d’alerte.', colonnes: {
    nom: 'Nom du lot', analyseur: 'Analyseur', site: 'Site', analyte: 'Analyse', periode_debut: 'Début de la période', periode_fin: 'Fin de la période', nb_resultats: 'Résultats pseudonymisés utilisés',
    seuil_bas: 'Seuil d’alerte bas calculé (2,5e percentile)', seuil_haut: 'Seuil d’alerte haut calculé (97,5e percentile)', statut: 'valide, a_valider ou a_revalider', derive_liee: 'Dérive qui a touché la période',
    valide_par: 'Biologiste', resultats_exposes: 'Résultats produits pendant la dérive', seuil_haut_sans_registre: 'Seuil haut si la dérive avait été vue en fin de mois' } },
  resultats: { table: 'reseau_resultats', description: 'Échantillon de résultats patients pseudonymisés (2026, 1 sur 100) : aucun nom, seulement un code.', colonnes: {
    pseudo: 'Code pseudonyme (PSN-…) : impossible de retrouver le nom sans la table de correspondance', site: 'Site de prélèvement', date: 'Jour du prélèvement',
    analyte: 'Analyse', sexe: 'F ou M', classe_age: 'Tranche d’âge (jamais l’âge exact)', valeur: 'Résultat', interpretation: 'normal, bas ou haut par rapport aux valeurs usuelles' } }
};

router.get('/dictionnaire', (req, res) => res.json({ tables: DICTIONNAIRE, sources: SOURCES }));

router.get('/export/:nom', async (req, res) => {
  const nom = String(req.params.nom).replace(/\.csv$/, '');
  const d = DICTIONNAIRE[nom];
  if (!d) return res.status(404).json({ erreur: 'Jeu de données inconnu.' });
  try {
    const colonnes = Object.keys(d.colonnes);
    const lignes = await db.all(`SELECT ${colonnes.join(', ')} FROM ${d.table}`);
    const lignesCsv = [colonnes, ...lignes.map((l) => colonnes.map((c) => (l[c] == null ? '' : l[c])))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="biologia-reseau-${nom}.csv"`);
    res.send(csvAvecBom(lignesCsv));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
