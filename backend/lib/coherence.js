const { plagePhysio } = require('./unites');

function severite(code) {
  if (['validation_avant_mesure', 'machine_maintenance', 'psn_inconnu'].includes(code)) return 'haute';
  if (['date_future', 'date_avant_naissance', 'valeur_impossible', 'unites_melangees'].includes(code)) return 'moyenne';
  return 'basse';
}

async function analyserLot(db, lot) {
  const anomalies = [];
  const mesures = await db.all('SELECT * FROM mesures_reference WHERE lot_id = ?', [lot.id]);
  const validations = await db.all('SELECT * FROM validations WHERE lot_id = ?', [lot.id]);
  const machine = lot.machine_id
    ? await db.get('SELECT * FROM machines WHERE id = ?', [lot.machine_id])
    : null;

  const vus = new Map();
  const unitesParParam = new Map();
  for (const m of mesures) {
    if (m.valeur === null || m.valeur === undefined || String(m.valeur) === '') {
      anomalies.push({ code: 'valeur_manquante', severite: 'basse', lot_id: lot.id, lot_nom: lot.nom, detail: `Mesure ${m.id} sans valeur`, href: `lot.html?id=${lot.id}` });
    }
    const cle = `${String(m.code_patient || '').toUpperCase()}|${m.parametre}|${m.date}`;
    if (vus.has(cle)) {
      anomalies.push({ code: 'doublon', severite: 'basse', lot_id: lot.id, lot_nom: lot.nom, detail: `Doublon ${m.code_patient} / ${m.parametre} / ${m.date}`, href: `lot.html?id=${lot.id}` });
    }
    vus.set(cle, true);
    const up = String(m.parametre || '');
    if (!unitesParParam.has(up)) unitesParParam.set(up, new Set());
    unitesParParam.get(up).add(String(m.unite || '').trim());
    if (m.date && m.date > new Date().toISOString().slice(0, 10) && lot.date && lot.date > new Date().toISOString().slice(0, 10)) {
      anomalies.push({ code: 'date_future', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `Date future ${m.date}`, href: `lot.html?id=${lot.id}` });
    } else if (m.date && m.date.slice(0, 10) > new Date().toISOString().slice(0, 10)) {
      anomalies.push({ code: 'date_future', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `Date future ${m.date}`, href: `lot.html?id=${lot.id}` });
    }
    if (typeof m.valeur === 'number' && m.valeur < 0) {
      anomalies.push({ code: 'valeur_impossible', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `${m.parametre}=${m.valeur} négatif (${m.code_patient})`, href: `lot.html?id=${lot.id}` });
    }
    const plage = plagePhysio(m.parametre);
    if (plage && typeof m.valeur === 'number' && (m.valeur < plage.min || m.valeur > plage.max)) {
      anomalies.push({ code: 'valeur_impossible', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `${m.parametre}=${m.valeur} hors plage ${plage.min}–${plage.max}`, href: `lot.html?id=${lot.id}` });
    }
    if (m.code_patient) {
      const psn = await db.get(
        `SELECT patients_pseudo.id, patients_identite.date_naissance
         FROM patients_pseudo
         LEFT JOIN patients_identite ON patients_identite.id = COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id)
         WHERE upper(COALESCE(patients_pseudo.psn, patients_pseudo.code)) = upper(?)`,
        [m.code_patient]
      );
      if (!psn) {
        anomalies.push({ code: 'psn_inconnu', severite: 'haute', lot_id: lot.id, lot_nom: lot.nom, detail: `PSN inconnu ${m.code_patient}`, href: `lot.html?id=${lot.id}` });
      } else if (psn.date_naissance && m.date && String(m.date).slice(0, 10) < String(psn.date_naissance).slice(0, 10)) {
        anomalies.push({ code: 'date_avant_naissance', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `${m.code_patient} : mesure ${m.date} avant naissance ${psn.date_naissance}`, href: `lot.html?id=${lot.id}` });
      }
    }
  }
  for (const [param, set] of unitesParParam) {
    const u = [...set].filter((x) => x !== '');
    if (u.length > 1) {
      anomalies.push({ code: 'unites_melangees', severite: 'moyenne', lot_id: lot.id, lot_nom: lot.nom, detail: `${param} : unités ${u.join(', ')}`, href: `lot.html?id=${lot.id}` });
    }
  }
  for (const v of validations) {
    const dv = String(v.date_validation || '').slice(0, 10);
    const dm = String(lot.date || '').slice(0, 10);
    if (dv && dm && dv < dm) {
      anomalies.push({ code: 'validation_avant_mesure', severite: 'haute', lot_id: lot.id, lot_nom: lot.nom, detail: `Validation ${dv} avant mesure ${dm}`, href: `lot.html?id=${lot.id}` });
    }
  }
  if (machine) {
    const statut = machine.statut_service || 'en_service';
    if (statut === 'maintenance' || statut === 'hors_service') {
      const depuis = machine.date_maintenance || machine.date_calibration;
      if (!lot.date || !depuis || lot.date >= String(depuis).slice(0, 10)) {
        anomalies.push({ code: 'machine_maintenance', severite: 'haute', lot_id: lot.id, lot_nom: lot.nom, detail: `Lot sur machine ${machine.nom} (${statut})`, href: `machines.html?id=${machine.id}` });
      }
    }
  }

  const nMes = Math.max(1, mesures.length);
  const nManq = anomalies.filter((a) => a.code === 'valeur_manquante').length;
  const completude = Math.round(100 * (1 - nManq / nMes));
  const nCoh = anomalies.filter((a) => ['doublon', 'unites_melangees', 'date_future', 'date_avant_naissance', 'valeur_impossible'].includes(a.code)).length;
  const coherence = Math.max(0, Math.round(100 * (1 - nCoh / nMes)));
  const nConf = anomalies.filter((a) => ['validation_avant_mesure', 'machine_maintenance', 'psn_inconnu'].includes(a.code)).length;
  const conformite = Math.max(0, 100 - nConf * 25);
  const score = Math.round((completude + coherence + conformite) / 3);
  return {
    lot_id: lot.id,
    lot_nom: lot.nom,
    anomalies,
    score_qualite: { completude, coherence, conformite, global: score }
  };
}

async function analyserTout(db) {
  const lots = await db.all('SELECT * FROM lots WHERE COALESCE(archive, 0) = 0 AND COALESCE(est_test, 0) = 0');
  const resultats = [];
  const toutes = [];
  for (const lot of lots) {
    const r = await analyserLot(db, lot);
    resultats.push(r);
    toutes.push(...r.anomalies);
  }
  return { lots: resultats, anomalies: toutes };
}

module.exports = { analyserLot, analyserTout, severite };
