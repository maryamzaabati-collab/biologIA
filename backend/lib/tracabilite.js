// Regles de verification des lots (tracabilite, RGPD, score, simulateur).

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
  /patient/i,
  /ipp/i
];

const MOIS_PEREMPTION = 12;

function extraireColonnesCsv(texte) {
  if (!texte || !String(texte).trim()) return [];
  const premiereLigne = String(texte).split(/\r?\n/).find((l) => l.trim());
  if (!premiereLigne) return [];
  return premiereLigne
    .split(/[;,]/)
    .map((c) => c.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function extraireValeursCsv(texte) {
  if (!texte || !String(texte).trim()) return [];
  const lignes = String(texte).split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const colonnes = extraireColonnesCsv(lignes[0]);
  const idx = colonnes.findIndex((c) => /^valeur$/i.test(c));
  if (idx < 0) return [];
  const valeurs = [];
  for (let i = 1; i < lignes.length; i++) {
    const cellules = lignes[i].split(/[;,]/);
    const n = Number(String(cellules[idx] || '').replace(',', '.').trim());
    if (!Number.isNaN(n)) valeurs.push(n);
  }
  return valeurs;
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
  return (colonnes || []).filter((c) => MOTIFS_IDENTITE.some((re) => re.test(c)));
}

function analyserCsv(csvTexte) {
  const colonnes = extraireColonnesCsv(csvTexte);
  const valeurs = extraireValeursCsv(csvTexte);
  return {
    colonnes,
    sensibles: colonnesSensibles(colonnes),
    valeurs,
    moyenne: moyenne(valeurs)
  };
}

function problemesLot({ machine_id, date, conditions, anonymise, sensibles }) {
  const problemes = [];
  if (!machine_id) problemes.push('Machine non renseignée');
  if (!date) problemes.push('Date de mesure manquante');
  if (!conditions) problemes.push('Conditions de mesure non renseignées');
  if (!anonymise) problemes.push('Identités patients non confirmées comme retirées');
  if (sensibles && sensibles.length) {
    problemes.push(`Colonnes identifiantes détectées : ${sensibles.join(', ')}`);
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

function libelleStatut(lot, validations = [], nbSignalements = 0) {
  if (Number(nbSignalements) > 0 || lot.statut === 'douteux') {
    return { code: 'douteux', libelle: 'Signalé' };
  }
  if (!validations.length) return { code: 'a_valider', libelle: 'À valider' };
  if (validationPerimee(validations)) return { code: 'a_revalider', libelle: 'À revalider' };
  return { code: 'ok', libelle: 'Validé' };
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
    limite_2s_bas: m === null ? null : m - 2 * sd,
    limite_2s_haut: m === null ? null : m + 2 * sd,
    hors_norme: (moyennes || []).map((v) => m !== null && sd > 0 && Math.abs(v - m) > 2 * sd)
  };
}

module.exports = {
  MOIS_PEREMPTION,
  extraireColonnesCsv,
  extraireValeursCsv,
  colonnesSensibles,
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
  pointsControle
};
