// Règles de vérification des lots (traçabilité, RGPD, score, cartes de contrôle).

const MOTIFS_IDENTITE = [
  /^nom$/i,
  /^noms?$/i,
  /prenom/i,
  /prénom/i,
  /date.?naiss/i,
  /naissance/i,
  /^adresse$/i,
  /nir/i,
  /securite.?sociale/i,
  /sécurité.?sociale/i,
  /email/i,
  /e-mail/i,
  /telephone/i,
  /téléphone/i,
  /^tel$/i,
  /^patient$/i,
  /ipp/i
];

const MOIS_PEREMPTION = 12;
const MIN_POINTS_CONTROLE = 20;
const RE_NOM_LOT = /^LOT-\d{4}-\d{3}$/;
const RE_NIR = /\b[12]\d{14}\b/;
const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RE_TEL = /(?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4}/;

function extraireColonnesCsv(texte) {
  if (!texte || !String(texte).trim()) return [];
  const premiereLigne = String(texte).split(/\r?\n/).find((l) => l.trim());
  if (!premiereLigne) return [];
  return premiereLigne
    .split(/[;,]/)
    .map((c) => c.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function cellulesLigne(ligne) {
  return String(ligne).split(/[;,]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
}

function extrairePointsCsv(texte) {
  if (!texte || !String(texte).trim()) {
    return { valeurs: [], dates: [], parametre: null };
  }
  const lignes = String(texte).split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return { valeurs: [], dates: [], parametre: null };
  const colonnes = extraireColonnesCsv(lignes[0]);
  const idxValeur = colonnes.findIndex((c) => /^(valeur|resultat|résultat)$/i.test(c));
  const idxDate = colonnes.findIndex((c) => /^date/i.test(c) && !/naiss/i.test(c));
  const idxParam = colonnes.findIndex((c) => /^(parametre|paramètre|analyte)$/i.test(c));
  if (idxValeur < 0) return { valeurs: [], dates: [], parametre: null };

  const lignesBrutes = [];
  for (let i = 1; i < lignes.length; i++) {
    const cellules = cellulesLigne(lignes[i]);
    const n = Number(String(cellules[idxValeur] || '').replace(',', '.').trim());
    if (Number.isNaN(n)) continue;
    lignesBrutes.push({
      valeur: n,
      date: idxDate >= 0 ? (cellules[idxDate] || null) : null,
      parametre: idxParam >= 0 ? (cellules[idxParam] || '') : ''
    });
  }

  let parametre = null;
  let choisis = lignesBrutes;
  if (idxParam >= 0 && lignesBrutes.length) {
    const comptes = new Map();
    for (const l of lignesBrutes) {
      const p = l.parametre || 'Paramètre';
      comptes.set(p, (comptes.get(p) || 0) + 1);
    }
    parametre = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (parametre) choisis = lignesBrutes.filter((l) => (l.parametre || 'Paramètre') === parametre);
  }

  return {
    valeurs: choisis.map((l) => l.valeur),
    dates: choisis.map((l) => l.date),
    parametre
  };
}

function extraireValeursCsv(texte) {
  return extrairePointsCsv(texte).valeurs;
}

function moyenne(valeurs) {
  if (!valeurs || !valeurs.length) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function ecartType(valeurs) {
  if (!valeurs || valeurs.length < 2) return 0;
  const m = moyenne(valeurs);
  const variance = valeurs.reduce((acc, v) => acc + (v - m) ** 2, 0) / (valeurs.length - 1);
  return Math.sqrt(variance);
}

function colonnesSensibles(colonnes) {
  return (colonnes || []).filter((c) => {
    if (/code|psn|pseudo|id_echantillon/i.test(c)) return false;
    return MOTIFS_IDENTITE.some((re) => re.test(c));
  });
}

function scannerContenuCsv(texte) {
  const trouvailles = [];
  if (!texte || !String(texte).trim()) return trouvailles;
  const lignes = String(texte).split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) return trouvailles;
  const colonnes = extraireColonnesCsv(lignes[0]);
  for (let i = 1; i < lignes.length; i++) {
    const cellules = cellulesLigne(lignes[i]);
    cellules.forEach((cellule, idx) => {
      const col = colonnes[idx] || `colonne ${idx + 1}`;
      if (RE_NIR.test(cellule.replace(/\s/g, ''))) {
        trouvailles.push(`NIR détecté dans ${col}`);
      }
      if (RE_EMAIL.test(cellule)) {
        trouvailles.push(`E-mail détecté dans ${col}`);
      }
      if (RE_TEL.test(cellule)) {
        trouvailles.push(`Téléphone détecté dans ${col}`);
      }
      if (/naiss/i.test(col) && /^\d{4}-\d{2}-\d{2}$/.test(cellule)) {
        trouvailles.push(`Date de naissance complète dans ${col}`);
      }
    });
  }
  return [...new Set(trouvailles)];
}

function analyserCsv(csvTexte) {
  const colonnes = extraireColonnesCsv(csvTexte);
  const points = extrairePointsCsv(csvTexte);
  const sensibles = colonnesSensibles(colonnes);
  const contenus = scannerContenuCsv(csvTexte);
  return {
    colonnes,
    sensibles,
    contenus_sensibles: contenus,
    valeurs: points.valeurs,
    dates: points.dates,
    parametre: points.parametre,
    moyenne: moyenne(points.valeurs)
  };
}

function problemesLot({ machine_id, date, conditions, anonymise, sensibles, contenus_sensibles }) {
  const problemes = [];
  if (!machine_id) problemes.push('Machine non renseignée');
  if (!date) problemes.push('Date de mesure manquante');
  if (!conditions) problemes.push('Conditions de mesure non renseignées');
  if (!anonymise) problemes.push('Pseudonymisation non confirmée');
  if (sensibles && sensibles.length) {
    problemes.push(`Colonnes identifiantes détectées : ${sensibles.join(', ')}`);
  }
  if (contenus_sensibles && contenus_sensibles.length) {
    problemes.push(`Données identifiantes dans le contenu : ${contenus_sensibles.join(', ')}`);
  }
  return problemes;
}

function valeurHistorique(v) {
  if (v === null || v === undefined || v === '') return '(vide)';
  return String(v);
}

function historiqueDifferent(champ, avant, apres) {
  if (champ === 'anonymise') return Number(avant || 0) !== Number(apres || 0);
  if (champ === 'machine_id') {
    const a = avant === null || avant === undefined || avant === '' ? null : Number(avant);
    const b = apres === null || apres === undefined || apres === '' ? null : Number(apres);
    return a !== b;
  }
  if (champ === 'colonnes_csv') {
    const normaliser = (v) => {
      if (v == null || v === '' || v === '(vide)') return '';
      try { return JSON.stringify(JSON.parse(v)); } catch { return String(v); }
    };
    return normaliser(avant) !== normaliser(apres);
  }
  return valeurHistorique(avant) !== valeurHistorique(apres);
}

function parseNombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function testerValeur(regle, valeurBrute) {
  const valeur = parseNombre(valeurBrute);
  if (valeur === null) {
    return { resultat: 'invalide', message: 'Saisissez un nombre (exemple fictif, pas un patient).' };
  }
  const bas = parseNombre(regle.seuil_bas);
  const haut = parseNombre(regle.seuil_haut);
  const unite = regle.unite ? ` ${regle.unite}` : '';
  if (bas !== null && valeur < bas) {
    return {
      resultat: 'alerte',
      message: `Alerte : ${valeur}${unite} est sous le seuil bas (${bas}${unite}). Règle basée sur le lot associé.`
    };
  }
  if (haut !== null && valeur > haut) {
    return {
      resultat: 'alerte',
      message: `Alerte : ${valeur}${unite} dépasse le seuil haut (${haut}${unite}). Règle basée sur le lot associé.`
    };
  }
  return {
    resultat: 'dans_la_normale',
    message: `Dans la normale : ${valeur}${unite} est dans l'intervalle calibré sur ce lot.`
  };
}

function ageEnMois(chaineDate) {
  if (!chaineDate) return null;
  const d = new Date(chaineDate.includes('T') || chaineDate.includes(' ') ? chaineDate.replace(' ', 'T') : chaineDate);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function validationPerimee(validations, mois = MOIS_PEREMPTION) {
  if (!validations || !validations.length) return false;
  const age = ageEnMois(validations[0].date_validation);
  return age !== null && age > mois;
}

function detailScoreConfiance(lot, validations = [], nbSignalements = 0) {
  const lignes = [];
  const push = (label, points, ok) => lignes.push({ label, points: ok ? points : 0, max: points, ok: Boolean(ok) });
  push('Machine renseignée', 15, Boolean(lot.machine_id));
  push('Date de mesure renseignée', 15, Boolean(lot.date));
  push('Conditions de mesure renseignées', 15, Boolean(lot.conditions));
  push('Pseudonymisation confirmée, sans colonne identifiante', 20, Number(lot.anonymise) && !Number(lot.alerte_identite));
  push('Aucun signalement ouvert', 20, Number(nbSignalements) === 0);
  const valOk = validations.length && !validationPerimee(validations);
  push('Validation biologiste à jour (moins de 12 mois)', 15, valOk);
  const score = Math.max(0, Math.min(100, lignes.reduce((s, l) => s + l.points, 0)));
  return { score, lignes };
}

function scoreConfiance(lot, validations = [], nbSignalements = 0) {
  return detailScoreConfiance(lot, validations, nbSignalements).score;
}

function lotIncomplet(lot) {
  return !lot.machine_id || !lot.date || !lot.conditions || !Number(lot.anonymise);
}

function libelleStatut(lot, validations = [], nbSignalements = 0) {
  if (Number(lot.archive)) return { code: 'archive', libelle: 'Archivé' };

  const identite = Number(lot.alerte_identite) || (lot.sensibles && lot.sensibles.length);
  const incomplet = lotIncomplet(lot);
  const n = Number(nbSignalements) || 0;

  if (identite) return { code: 'signale', libelle: 'Signalé' };
  if (incomplet) return { code: 'brouillon', libelle: 'Brouillon' };
  if (n > 0) return { code: 'signale', libelle: 'Signalé' };
  if (!validations.length) return { code: 'a_valider', libelle: 'À valider' };
  if (validationPerimee(validations) || Number(lot.modifie_apres_validation)) {
    return { code: 'a_revalider', libelle: 'À revalider' };
  }
  return { code: 'valide', libelle: 'Validé' };
}

function libelleSeuils(regle) {
  if (!regle) return 'non définie';
  const u = regle.unite ? ` ${regle.unite}` : '';
  const vide = (v) => v === null || v === undefined || String(v).trim() === '';
  const bas = vide(regle.seuil_bas) ? null : String(regle.seuil_bas);
  const haut = vide(regle.seuil_haut) ? null : String(regle.seuil_haut);
  if (bas && haut) return `${bas} – ${haut}${u}`;
  if (bas) return `≥ ${bas}${u}`;
  if (haut) return `≤ ${haut}${u}`;
  return `seuils non définis${u}`;
}

function genererCodeVerification() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LT-';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function pointsControle(moyennes) {
  const m = moyenne(moyennes);
  const sd = ecartType(moyennes);
  return {
    moyenne: m,
    ecart_type: sd,
    limite_1s_bas: m === null ? null : m - sd,
    limite_1s_haut: m === null ? null : m + sd,
    limite_2s_bas: m === null ? null : m - 2 * sd,
    limite_2s_haut: m === null ? null : m + 2 * sd,
    limite_3s_bas: m === null ? null : m - 3 * sd,
    limite_3s_haut: m === null ? null : m + 3 * sd,
    hors_norme: (moyennes || []).map((v) => m !== null && sd > 0 && Math.abs(v - m) > 2 * sd)
  };
}

function westgard(valeurs, m, sd) {
  const alertes = [];
  if (!sd) return alertes;
  (valeurs || []).forEach((v, i) => {
    if (Math.abs(v - m) > 3 * sd) {
      alertes.push({
        regle: '1-3s',
        index: i,
        message: `Règle 1-3s : le point ${i + 1} sort de ±3σ`
      });
    }
  });
  for (let i = 1; i < (valeurs || []).length; i++) {
    const a = valeurs[i - 1] - m;
    const b = valeurs[i] - m;
    if (Math.abs(a) > 2 * sd && Math.abs(b) > 2 * sd && Math.sign(a) === Math.sign(b) && Math.sign(a) !== 0) {
      alertes.push({
        regle: '2-2s',
        index: i,
        message: `Règle 2-2s : les points ${i} et ${i + 1} sont consécutifs hors ±2σ du même côté`
      });
    }
  }
  return alertes;
}

function carteLeveyJennings(valeurs, dates = []) {
  const vals = (valeurs || []).map(Number).filter((v) => !Number.isNaN(v));
  const messageInsuffisant = 'Pas assez de données pour calculer les limites';
  if (vals.length < MIN_POINTS_CONTROLE) {
    return {
      suffisant: false,
      message: messageInsuffisant,
      nb_points: vals.length,
      nb_reference: vals.length,
      moyenne: null,
      ecart_type: 0,
      limite_1s_bas: null,
      limite_1s_haut: null,
      limite_2s_bas: null,
      limite_2s_haut: null,
      limite_3s_bas: null,
      limite_3s_haut: null,
      hors_norme: vals.map(() => false),
      westgard: [],
      points: vals.map((v, i) => ({
        valeur: v,
        moyenne_controle: v,
        date: dates[i] || null,
        hors_norme: false
      }))
    };
  }
  const stats = pointsControle(vals);
  if (!stats.ecart_type) {
    return {
      suffisant: false,
      message: 'Écart-type nul : les valeurs du CSV sont identiques, limites non calculables',
      nb_points: vals.length,
      nb_reference: vals.length,
      moyenne: stats.moyenne,
      ecart_type: 0,
      limite_1s_bas: null,
      limite_1s_haut: null,
      limite_2s_bas: null,
      limite_2s_haut: null,
      limite_3s_bas: null,
      limite_3s_haut: null,
      hors_norme: vals.map(() => false),
      westgard: [],
      points: vals.map((v, i) => ({
        valeur: v,
        moyenne_controle: v,
        date: dates[i] || null,
        hors_norme: false
      }))
    };
  }
  const alertes = westgard(vals, stats.moyenne, stats.ecart_type);
  const indicesWestgard = new Set();
  for (const a of alertes) {
    indicesWestgard.add(a.index);
    if (a.regle === '2-2s' && a.index > 0) indicesWestgard.add(a.index - 1);
  }
  const hors = vals.map((v, i) => stats.hors_norme[i] || indicesWestgard.has(i));
  return {
    suffisant: true,
    message: null,
    nb_points: vals.length,
    nb_reference: vals.length,
    ...stats,
    hors_norme: hors,
    westgard: alertes,
    points: vals.map((v, i) => ({
      valeur: v,
      moyenne_controle: v,
      date: dates[i] || null,
      hors_norme: hors[i]
    }))
  };
}

function leveyJennings(valeurs) {
  return carteLeveyJennings(valeurs);
}

function nomLotValide(nom, estTest = false) {
  if (estTest) return true;
  return RE_NOM_LOT.test(String(nom || '').trim());
}

function dateDansLeFutur(date) {
  if (!date) return false;
  const s = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const cible = new Date(y, m - 1, d);
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  return cible.getTime() > auj.getTime();
}

function composerConditions(body) {
  const temperature = String(body.temperature || '').trim();
  const lotReactifs = String(body.lot_reactifs || '').trim();
  const calibration = String(body.calibration || '').trim();
  if (temperature || lotReactifs || calibration) {
    const parts = [];
    if (temperature) parts.push(`Température ${temperature}`);
    if (lotReactifs) parts.push(`Lot de réactifs ${lotReactifs}`);
    if (calibration) parts.push(`Calibration ${calibration}`);
    return parts.join(', ');
  }
  return body.conditions ? String(body.conditions).trim() : null;
}

function conditionsStructurees(texte) {
  const t = String(texte || '');
  return /temp/i.test(t) && /r[eé]actif/i.test(t) && /calibr/i.test(t);
}

function validerSaisieLot(data, { estTest = false, strict = true } = {}) {
  const erreurs = [];
  if (!data.nom) erreurs.push('Le nom du lot est obligatoire.');
  else if (!nomLotValide(data.nom, estTest)) {
    erreurs.push('Le nom doit suivre le format LOT-YYYY-NNN (exemple : LOT-2026-025).');
  }
  if (strict && !estTest) {
    if (!data.machine_id) erreurs.push('La machine est obligatoire.');
    if (!data.date) erreurs.push('La date de mesure est obligatoire.');
    if (dateDansLeFutur(data.date)) erreurs.push('La date de mesure ne peut pas être dans le futur.');
    if (!data.conditions) {
      erreurs.push('Indiquez la température, le lot de réactifs et la calibration.');
    } else if (!conditionsStructurees(data.conditions)) {
      erreurs.push('Conditions incomplètes : température, lot de réactifs et calibration sont requis.');
    }
  } else if (data.date && dateDansLeFutur(data.date)) {
    erreurs.push('La date de mesure ne peut pas être dans le futur.');
  }
  return erreurs;
}

function codePseudo() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PSN-';
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function trancheAge(dateNaissance) {
  if (!dateNaissance) return null;
  const d = new Date(String(dateNaissance).slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  if (age < 18) return '0-17';
  if (age < 30) return '18-29';
  if (age < 45) return '30-44';
  if (age < 60) return '45-59';
  if (age < 75) return '60-74';
  return '75+';
}

function testerAnonymisation(csvTexte) {
  const analyse = analyserCsv(csvTexte);
  const controles = [];

  const identifiants = [
    ...analyse.sensibles.map((c) => `colonne ${c}`),
    ...analyse.contenus_sensibles
  ];
  controles.push({
    code: 'identifiants',
    ok: identifiants.length === 0,
    libelle: 'Aucune colonne identifiante, ni NIR / e-mail / téléphone dans les valeurs',
    detail: identifiants.length ? identifiants.join(' ; ') : 'Aucun identifiant détecté'
  });

  const naissance = analyse.contenus_sensibles.filter((x) => /naissance/i.test(x));
  controles.push({
    code: 'dates',
    ok: naissance.length === 0,
    libelle: 'Aucune date de naissance complète',
    detail: naissance.length ? naissance.join(' ; ') : 'Pas de date de naissance JJ/MM/AAAA'
  });

  const lignes = String(csvTexte || '').split(/\r?\n/).filter((l) => l.trim());
  const colonnes = extraireColonnesCsv(csvTexte);
  const idxAge = colonnes.findIndex((c) => /tranche|age|âge/i.test(c));
  const idxSexe = colonnes.findIndex((c) => /sexe|genre/i.test(c));
  const idxDep = colonnes.findIndex((c) => /depart|départ/i.test(c));
  let kMin = null;
  let kOk = false;
  if (idxAge >= 0 && idxSexe >= 0 && idxDep >= 0 && lignes.length > 1) {
    const groupes = new Map();
    for (let i = 1; i < lignes.length; i++) {
      const c = cellulesLigne(lignes[i]);
      const cle = `${c[idxAge]}|${c[idxSexe]}|${c[idxDep]}`;
      groupes.set(cle, (groupes.get(cle) || 0) + 1);
    }
    kMin = groupes.size ? Math.min(...groupes.values()) : 0;
    kOk = kMin >= 5;
  }
  controles.push({
    code: 'k_anonymat',
    ok: kOk,
    libelle: 'Chaque combinaison (âge + sexe + département) apparaît au moins 5 fois (k ≥ 5)',
    detail: kMin === null
      ? 'Colonnes tranche d’âge, sexe et département absentes — test non applicable'
      : `k minimum observé : ${kMin}`
  });

  controles.push({
    code: 'irreversible',
    ok: identifiants.length === 0,
    libelle: 'Impossible de remonter à l’identité sans la table de correspondance',
    detail: identifiants.length
      ? 'Des identifiants restent dans le fichier'
      : 'Seuls des codes PSN ou des attributs généralisés sont présents'
  });

  const applicables = controles.filter((c) => c.code !== 'k_anonymat' || kMin !== null);
  return {
    ok: applicables.every((c) => c.ok),
    controles,
    colonnes: analyse.colonnes,
    nb_lignes: Math.max(0, lignes.length - 1)
  };
}

function celluleCsv(valeur) {
  let s = String(valeur ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvAvecBom(lignes) {
  const corps = lignes.map((l) => l.map(celluleCsv).join(';')).join('\r\n');
  return `\uFEFF${corps}`;
}

module.exports = {
  MOIS_PEREMPTION,
  MIN_POINTS_CONTROLE,
  RE_NOM_LOT,
  extraireColonnesCsv,
  extraireValeursCsv,
  extrairePointsCsv,
  colonnesSensibles,
  scannerContenuCsv,
  analyserCsv,
  problemesLot,
  valeurHistorique,
  historiqueDifferent,
  testerValeur,
  scoreConfiance,
  detailScoreConfiance,
  libelleStatut,
  libelleSeuils,
  validationPerimee,
  genererCodeVerification,
  moyenne,
  ecartType,
  pointsControle,
  leveyJennings,
  carteLeveyJennings,
  westgard,
  nomLotValide,
  dateDansLeFutur,
  composerConditions,
  conditionsStructurees,
  validerSaisieLot,
  codePseudo,
  trancheAge,
  testerAnonymisation,
  celluleCsv,
  csvAvecBom
};
