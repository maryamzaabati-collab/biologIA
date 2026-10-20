const UNITES = {
  'glycémie à jeun': ['g/L', 'mmol/L'],
  'hba1c': ['%'],
  'hémoglobine': ['g/dL', 'g/L'],
  'tsh': ['mUI/L'],
  'crp': ['mg/L'],
  'potassium': ['mmol/L'],
  'créatinine': ['µmol/L', 'umol/L', 'mg/L'],
  'ph': [''],
  'cholestérol total': ['g/L', 'mmol/L'],
  'plaquettes': ['G/L'],
  'contrôle négatif': ['']
};

const PLAGES = {
  'glycémie à jeun': { min: 0.2, max: 8 },
  'hba1c': { min: 3, max: 18 },
  'hémoglobine': { min: 4, max: 22 },
  'tsh': { min: 0, max: 80 },
  'crp': { min: 0, max: 400 },
  'potassium': { min: 1.5, max: 8 },
  'créatinine': { min: 10, max: 2000 },
  'ph': { min: 6.5, max: 8 },
  'cholestérol total': { min: 0.4, max: 6 },
  'plaquettes': { min: 10, max: 1200 }
};

function cleParametre(p) {
  return String(p || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function unitesDuParametre(parametre) {
  const cle = cleParametre(parametre);
  for (const [k, v] of Object.entries(UNITES)) {
    if (cleParametre(k) === cle) return v;
  }
  return null;
}

function uniteCoherente(parametre, unite) {
  const liste = unitesDuParametre(parametre);
  if (!liste) return true;
  const u = String(unite || '').trim();
  if (liste.includes('') && u === '') return true;
  return liste.some((x) => x.toLowerCase() === u.toLowerCase());
}

function validerRegle({ parametre, seuil_bas, seuil_haut, unite }) {
  const erreurs = [];
  if (!parametre) erreurs.push('Le paramètre est obligatoire.');
  if (unite === undefined || unite === null || String(unite).trim() === '') {
    if (!unitesDuParametre(parametre) || !unitesDuParametre(parametre).includes('')) {
      erreurs.push('L’unité est obligatoire.');
    }
  } else if (!uniteCoherente(parametre, unite)) {
    const liste = unitesDuParametre(parametre);
    erreurs.push(`Unité incohérente pour ${parametre} (attendu : ${(liste || []).join(', ') || 'libre'}).`);
  }
  const bas = seuil_bas === null || seuil_bas === undefined || String(seuil_bas).trim() === ''
    ? null : Number(String(seuil_bas).replace(',', '.'));
  const haut = seuil_haut === null || seuil_haut === undefined || String(seuil_haut).trim() === ''
    ? null : Number(String(seuil_haut).replace(',', '.'));
  if (bas !== null && Number.isNaN(bas)) erreurs.push('Seuil bas invalide.');
  if (haut !== null && Number.isNaN(haut)) erreurs.push('Seuil haut invalide.');
  if (bas !== null && haut !== null && bas > haut) {
    erreurs.push('Le seuil bas ne peut pas être supérieur au seuil haut.');
  }
  return erreurs;
}

function plagePhysio(parametre) {
  const cle = cleParametre(parametre);
  for (const [k, v] of Object.entries(PLAGES)) {
    if (cleParametre(k) === cle) return v;
  }
  return null;
}

module.exports = { UNITES, validerRegle, uniteCoherente, unitesDuParametre, plagePhysio, cleParametre };
