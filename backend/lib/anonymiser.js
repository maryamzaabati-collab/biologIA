const { trancheAge, testerAnonymisation, csvAvecBom } = require('./tracabilite');

const REGIONS = {
  '75': 'Île-de-France', '77': 'Île-de-France', '78': 'Île-de-France', '91': 'Île-de-France', '92': 'Île-de-France', '93': 'Île-de-France', '94': 'Île-de-France', '95': 'Île-de-France',
  '13': 'PACA', '06': 'PACA', '83': 'PACA', '84': 'PACA',
  '69': 'Auvergne-Rhône-Alpes', '38': 'Auvergne-Rhône-Alpes', '73': 'Auvergne-Rhône-Alpes',
  '33': 'Nouvelle-Aquitaine', '40': 'Nouvelle-Aquitaine',
  '44': 'Pays de la Loire', '49': 'Pays de la Loire',
  '31': 'Occitanie', '34': 'Occitanie', '11': 'Occitanie',
  '59': 'Hauts-de-France', '62': 'Hauts-de-France',
  '67': 'Grand Est', '68': 'Grand Est',
  '29': 'Bretagne', '35': 'Bretagne'
};

function regionDe(dep) {
  return REGIONS[String(dep || '').padStart(2, '0')] || 'Autre';
}

function ageLarge(tranche) {
  if (tranche === '0-17' || tranche === '18-29') return '0-29';
  if (tranche === '30-44' || tranche === '45-59') return '30-59';
  return '60+';
}

function moisMesure(date) {
  const s = String(date || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function compterGroupes(lignes) {
  const groupes = new Map();
  for (const l of lignes) {
    const cle = `${l.tranche_age}|${l.sexe}|${l.territoire}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(l);
  }
  return groupes;
}

function genererJeu(lignesBrutes) {
  let lignes = lignesBrutes.map((l) => ({
    tranche_age: trancheAge(l.date_naissance) || 'inconnu',
    sexe: l.sexe || '',
    territoire: String(l.departement || (l.code_postal || '').slice(0, 2) || ''),
    parametre: l.parametre || '',
    valeur: l.valeur,
    unite: l.unite || '',
    mois: moisMesure(l.date)
  }));

  let generalisees = 0;
  let supprimees = 0;

  for (let tour = 0; tour < 2; tour++) {
    const groupes = compterGroupes(lignes);
    const petites = [...groupes.entries()].filter(([, g]) => g.length < 5);
    if (!petites.length) break;
    const ids = new Set(petites.flatMap(([, g]) => g));
    lignes = lignes.map((l) => {
      if (!ids.has(l)) return l;
      generalisees += 1;
      if (tour === 0) return { ...l, tranche_age: ageLarge(l.tranche_age) };
      return { ...l, territoire: regionDe(l.territoire) };
    });
  }

  const restants = [];
  const groupesFin = compterGroupes(lignes);
  for (const [, g] of groupesFin) {
    if (g.length < 5) {
      supprimees += g.length;
    } else {
      restants.push(...g);
    }
  }

  const groupesOk = compterGroupes(restants);
  const tailles = [...groupesOk.values()].map((g) => g.length);
  const kMin = tailles.length ? Math.min(...tailles) : 0;

  return {
    lignes: restants,
    generalisees,
    supprimees,
    k_min: kMin,
    nb_lignes: restants.length
  };
}

function csvDuJeu(lignes) {
  const table = [['tranche_age', 'sexe', 'territoire', 'parametre', 'valeur', 'unite', 'mois']];
  for (const l of lignes) {
    table.push([l.tranche_age, l.sexe, l.territoire, l.parametre, l.valeur, l.unite, l.mois || '']);
  }
  return { table, texte: csvAvecBom(table) };
}

function testerReidentification(lignesAnon, identites) {
  let unSeul = 0;
  for (const l of lignesAnon) {
    const candidats = identites.filter((p) => {
      const t = trancheAge(p.date_naissance);
      const dep = String(p.departement || (p.code_postal || '').slice(0, 2) || '');
      const trop = regionDe(dep);
      const sexeOk = String(p.sexe) === String(l.sexe);
      const ageOk = t === l.tranche_age || ageLarge(t) === l.tranche_age;
      const lieuOk = dep === l.territoire || trop === l.territoire;
      return sexeOk && ageOk && lieuOk;
    });
    if (candidats.length === 1) unSeul += 1;
  }
  return unSeul;
}

function enrichirRapport(csvTexte, identites = []) {
  const base = testerAnonymisation(csvTexte);
  const lignes = String(csvTexte || '').split(/\r?\n/).filter((l) => l.trim());
  const cols = (lignes[0] || '').split(/[;,]/).map((c) => c.trim().toLowerCase());
  const aPsn = cols.some((c) => /psn|code_patient|numero_patient|nir|nom|prenom/.test(c));
  const corps = lignes.slice(1).join(' ');
  const psnDansValeurs = /PSN-[A-Z0-9]+/i.test(corps);

  const groupes = new Map();
  const iAge = cols.findIndex((c) => /tranche|age/.test(c));
  const iSexe = cols.findIndex((c) => /sexe/.test(c));
  const iTer = cols.findIndex((c) => /territoire|depart|région|region/.test(c));
  if (iAge >= 0 && iSexe >= 0 && iTer >= 0) {
    for (let i = 1; i < lignes.length; i++) {
      const c = lignes[i].split(/[;,]/);
      const cle = `${c[iAge]}|${c[iSexe]}|${c[iTer]}`;
      groupes.set(cle, (groupes.get(cle) || 0) + 1);
    }
  }
  const petits = [...groupes.entries()].filter(([, n]) => n < 5).map(([k, n]) => `${k} (${n})`);
  const kMin = groupes.size ? Math.min(...groupes.values()) : null;

  const kCtrl = base.controles.find((c) => c.code === 'k_anonymat');
  if (kCtrl && petits.length) {
    kCtrl.detail = `k minimum : ${kMin}. Groupes < 5 : ${petits.slice(0, 8).join(' ; ')}`;
    kCtrl.ok = false;
  } else if (kCtrl && kMin != null) {
    kCtrl.detail = `k minimum observé : ${kMin}`;
  }

  const lignesAnon = identites.length ? lignes.slice(1).map((ligne) => {
    const c = ligne.split(/[;,]/);
    return {
      tranche_age: iAge >= 0 ? c[iAge] : '',
      sexe: iSexe >= 0 ? c[iSexe] : '',
      territoire: iTer >= 0 ? c[iTer] : ''
    };
  }) : [];
  const reident = identites.length ? testerReidentification(lignesAnon, identites) : 0;

  base.controles.push({
    code: 'colonnes',
    ok: !aPsn,
    libelle: 'Aucune colonne identifiante (nom, prénom, numéro, NIR, PSN)',
    detail: aPsn ? `Colonnes : ${cols.join(', ')}` : `Colonnes contrôlées : ${cols.join(', ') || 'aucune'}`
  });
  base.controles.push({
    code: 'psn',
    ok: !psnDansValeurs,
    libelle: 'Absence de PSN dans le jeu anonymisé',
    detail: psnDansValeurs ? 'Au moins une valeur ressemble à un PSN' : 'Aucun PSN détecté'
  });
  base.controles.push({
    code: 'reidentification',
    ok: reident === 0,
    libelle: 'Test de ré-identification (âge + sexe + territoire → un seul candidat)',
    detail: `${reident} ligne(s) n’ont qu’un seul candidat dans patients_identite (doit être 0)`
  });

  base.ok = base.controles.every((c) => c.ok || c.code === 'irreversible');
  base.ok = base.controles.filter((c) => c.code !== 'irreversible').every((c) => c.ok);
  base.k_min = kMin;
  base.groupes_faibles = petits;
  return base;
}

function csvPiege() {
  const table = [
    ['nom', 'prenom', 'nir', 'tranche_age', 'sexe', 'territoire', 'parametre', 'valeur'],
    ['Martin', 'Léa', '285057512345678', '18-29', 'F', '975', 'Glycémie à jeun', '0.92'],
    ['Kerguelen', 'Ulysse', '185057599999999', '0-17', 'M', '975', 'Glycémie à jeun', '0.88']
  ];
  return csvAvecBom(table);
}

module.exports = { genererJeu, csvDuJeu, enrichirRapport, csvPiege, testerReidentification };
