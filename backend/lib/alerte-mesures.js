const { testerValeur } = require('./tracabilite');

function extraireMesuresCsv(csvTexte, dateLot) {
  const lignes = String(csvTexte || '').split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const cols = lignes[0].split(/[;,]/).map((c) => c.trim());
  const iCode = cols.findIndex((c) => /code_patient|psn/i.test(c));
  const iPar = cols.findIndex((c) => /parametre|paramètre/i.test(c));
  const iVal = cols.findIndex((c) => /valeur|resultat/i.test(c));
  const iUni = cols.findIndex((c) => /unite|unité/i.test(c));
  const iDat = cols.findIndex((c) => /^date/i.test(c) && !/naiss/i.test(c));
  const out = [];
  for (let k = 1; k < lignes.length; k++) {
    const c = lignes[k].split(/[;,]/);
    const valeur = iVal >= 0 ? Number(String(c[iVal] || '').replace(',', '.')) : NaN;
    out.push({
      psn: iCode >= 0 ? c[iCode] : '',
      parametre: iPar >= 0 ? c[iPar] : '',
      valeur: Number.isNaN(valeur) ? null : valeur,
      unite: iUni >= 0 ? c[iUni] : '',
      date: iDat >= 0 ? c[iDat] : dateLot
    });
  }
  return out;
}

async function appliquerReglesSurLot(db, lotId) {
  const lot = await db.get('SELECT * FROM lots WHERE id = ?', [lotId]);
  if (!lot) return [];
  const mesures = await db.all('SELECT * FROM mesures_reference WHERE lot_id = ?', [lotId]);
  const regles = await db.all(
    `SELECT * FROM regles_alerte WHERE statut = 'validee' AND (
      lot_id = ? OR lower(parametre) IN (SELECT lower(parametre) FROM mesures_reference WHERE lot_id = ?)
    )`,
    [lotId, lotId]
  );
  const crees = [];
  for (const regle of regles) {
    const hits = mesures.filter((m) => {
      if (String(m.parametre || '').toLowerCase() !== String(regle.parametre || '').toLowerCase()) return false;
      return testerValeur(regle, m.valeur).resultat === 'alerte';
    });
    if (!hits.length) continue;
    const liste = hits.map((m) => ({
      psn: m.code_patient,
      valeur: m.valeur,
      unite: m.unite || regle.unite,
      date: m.date,
      mesure_id: m.id
    }));
    const raison = `Règle ${regle.parametre} ${regle.seuil_bas ?? '—'}–${regle.seuil_haut ?? '—'} ${regle.unite || ''} : ${hits.length} mesure(s) hors seuil.`;
    await db.run(
      `INSERT INTO signalements (lot_id, raison, mesures_json, regle_id) VALUES (?, ?, ?, ?)`,
      [lotId, raison, JSON.stringify(liste), regle.id]
    );
    crees.push({ regle_id: regle.id, n: hits.length, mesures: liste });
  }
  return crees;
}

module.exports = { extraireMesuresCsv, appliquerReglesSurLot };
