const { codePseudo } = require('./tracabilite');

function normaliserNom(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .trim()
    .toLowerCase();
}

function chiffreControle(annee, seq5) {
  const chiffres = `${annee}${seq5}`;
  let somme = 0;
  let double = true;
  for (let i = chiffres.length - 1; i >= 0; i--) {
    let n = Number(chiffres[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
    double = !double;
  }
  return (10 - (somme % 10)) % 10;
}

function composerNumero(annee, seq) {
  const seq5 = String(seq).padStart(5, '0');
  return `NP-${annee}-${seq5}${chiffreControle(annee, seq5)}`;
}

function analyserNumero(brut) {
  const s = String(brut || '').trim().toUpperCase();
  const m = s.match(/^NP-(\d{4})-(\d{5})(\d)$/);
  if (!m) return { ok: false, raison: 'format' };
  const annee = m[1];
  const seq5 = m[2];
  const attendu = chiffreControle(annee, seq5);
  if (Number(m[3]) !== attendu) return { ok: false, raison: 'controle', numero: s };
  return { ok: true, numero: s, annee: Number(annee), seq: Number(seq5) };
}

function distanceLevenshtein(a, b) {
  const u = String(a || '');
  const v = String(b || '');
  const lignes = Array.from({ length: u.length + 1 }, () => []);
  for (let i = 0; i <= u.length; i++) lignes[i][0] = i;
  for (let j = 0; j <= v.length; j++) lignes[0][j] = j;
  for (let i = 1; i <= u.length; i++) {
    for (let j = 1; j <= v.length; j++) {
      const cout = u[i - 1] === v[j - 1] ? 0 : 1;
      lignes[i][j] = Math.min(
        lignes[i - 1][j] + 1,
        lignes[i][j - 1] + 1,
        lignes[i - 1][j - 1] + cout
      );
    }
  }
  return lignes[u.length][v.length];
}

function dateNaissancePlausible(iso) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Date de naissance invalide.';
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Date de naissance invalide.';
  const auj = new Date();
  if (d > auj) return 'La date de naissance ne peut pas être dans le futur.';
  const age = (auj - d) / (1000 * 60 * 60 * 24 * 365.25);
  if (age > 120 || d.getFullYear() < 1900) return 'Date de naissance hors plage plausible.';
  return null;
}

function validerCreation(body) {
  const nom = String(body.nom || '').trim();
  const prenom = String(body.prenom || '').trim();
  const date_naissance = String(body.date_naissance || '').slice(0, 10);
  const sexe = String(body.sexe || '').trim().toUpperCase();
  const ville = String(body.ville || '').trim();
  const code_postal = String(body.code_postal || '').trim();
  const erreurs = [];
  if (!nom) erreurs.push('Le nom est obligatoire.');
  if (!prenom) erreurs.push('Le prénom est obligatoire.');
  const dateErr = dateNaissancePlausible(date_naissance);
  if (dateErr) erreurs.push(dateErr);
  if (!['M', 'F'].includes(sexe)) erreurs.push('Le sexe doit être M ou F.');
  if (!ville) erreurs.push('La ville est obligatoire.');
  if (!/^\d{5}$/.test(code_postal)) erreurs.push('Le code postal doit contenir 5 chiffres.');
  return {
    erreurs,
    fiche: { nom, prenom, date_naissance, sexe, ville, code_postal }
  };
}

function detecterDoublons(fiche, existants) {
  const nomN = normaliserNom(fiche.nom);
  const date = String(fiche.date_naissance).slice(0, 10);
  const exact = [];
  const proches = [];
  for (const p of existants || []) {
    const memeDate = String(p.date_naissance || '').slice(0, 10) === date;
    if (!memeDate) continue;
    const autre = normaliserNom(p.nom);
    if (autre === nomN) exact.push(p);
    else if (distanceLevenshtein(autre, nomN) === 1) proches.push(p);
  }
  return { exact, proches };
}

function extrairePsnCsv(texte) {
  const lignes = String(texte || '').split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const cols = lignes[0].split(/[;,]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  const idx = cols.findIndex((c) => /code_patient|psn/i.test(c));
  if (idx < 0) return [];
  const codes = [];
  for (let i = 1; i < lignes.length; i++) {
    const cellules = lignes[i].split(/[;,]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const v = String(cellules[idx] || '').trim().toUpperCase();
    if (v) codes.push(v);
  }
  return codes;
}

async function prochainNumero(db, annee = 2026) {
  const rows = await db.all(
    "SELECT numero_patient FROM patients_identite WHERE numero_patient LIKE ?",
    [`NP-${annee}-%`]
  );
  let max = 0;
  for (const r of rows) {
    const lu = analyserNumero(r.numero_patient);
    if (lu.ok && lu.seq > max) max = lu.seq;
  }
  return composerNumero(annee, max + 1);
}

function psnAleatoire() {
  return codePseudo();
}

module.exports = {
  normaliserNom,
  chiffreControle,
  composerNumero,
  analyserNumero,
  distanceLevenshtein,
  dateNaissancePlausible,
  validerCreation,
  detecterDoublons,
  extrairePsnCsv,
  prochainNumero,
  psnAleatoire
};
