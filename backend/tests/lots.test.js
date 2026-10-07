const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../db');
const app = require('../app');

let server;
let base;

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

async function json(chemin, options = {}) {
  const r = await fetch(`${base}${chemin}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

function payload(extra = {}) {
  return {
    nom: extra.nom || 'LOT-2026-101',
    machine_id: extra.machine_id,
    date: extra.date || '2026-03-01',
    temperature: extra.temperature || '21°C',
    lot_reactifs: extra.lot_reactifs || 'R-441',
    calibration: extra.calibration || 'matin',
    anonymise: extra.anonymise !== undefined ? extra.anonymise : true,
    csv_texte: extra.csv_texte || '',
    motif: extra.motif || 'Correction pédagogique'
  };
}

describe('routes lots', () => {
  it('refuse un lot sans nom', async () => {
    const { status, data } = await json('/api/lots', { method: 'POST', body: JSON.stringify({}) });
    assert.equal(status, 400);
    assert.match(data.erreur, /nom/i);
  });

  it('refuse un nom hors format LOT-YYYY-NNN', async () => {
    const { status, data } = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'loot' })
    });
    assert.equal(status, 400);
    assert.match(data.erreur, /LOT-/);
  });

  it('cree un lot complet puis le corrige via PUT avec motif', async () => {
    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Cobas test', type: 'biochimie' })
    });
    assert.equal(machine.status, 201);

    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify(payload({ nom: 'LOT-2026-201', machine_id: machine.data.id }))
    });
    assert.equal(cree.status, 201);
    const id = cree.data.id;

    const detail = await json(`/api/lots/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.statut_affiche, 'a_valider');

    const maj = await json(`/api/lots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload({
        nom: 'LOT-2026-201',
        machine_id: machine.data.id,
        date: '2026-03-02',
        motif: 'Ajustement de date après CQ'
      }))
    });
    assert.equal(maj.status, 200);

    const apres = await json(`/api/lots/${id}`);
    assert.ok(apres.data.historique.length > 0);
    assert.ok(apres.data.historique.some((h) => h.motif));
  });

  it('renvoie 404 pour un lot inexistant', async () => {
    const { status, data } = await json(' /api/lots/99999'.trim());
    assert.equal(status, 404);
    assert.match(data.erreur, /existe pas/);
  });

  it('refuse la validation si le biologiste n est pas enregistre', async () => {
    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Architect test', type: 'immuno' })
    });
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify(payload({ nom: 'LOT-2026-202', machine_id: machine.data.id }))
    });
    const { status } = await json(`/api/lots/${cree.data.id}/validations`, {
      method: 'POST',
      body: JSON.stringify({ nom_biologiste: 'Inconnu Dupont' })
    });
    assert.equal(status, 400);
  });

  it('refuse la suppression et archive a la place', async () => {
    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Sysmex test', type: 'hemato' })
    });
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify(payload({ nom: 'LOT-2026-203', machine_id: machine.data.id }))
    });
    const suppr = await json(`/api/lots/${cree.data.id}`, { method: 'DELETE' });
    assert.equal(suppr.status, 405);
    const arch = await json(`/api/lots/${cree.data.id}/archiver`, { method: 'POST', body: '{}' });
    assert.equal(arch.status, 200);
    const liste = await json('/api/lots');
    assert.ok(!liste.data.some((l) => l.id === cree.data.id));
  });

  it('refuse de resoudre un signalement si le lot n est pas corrige', async () => {
    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'ABL test', type: 'gaz' })
    });
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify(payload({
        nom: 'LOT-2026-204',
        machine_id: machine.data.id,
        anonymise: false
      }))
    });
    const detail = await json(`/api/lots/${cree.data.id}`);
    const sid = detail.data.signalements[0].id;
    const r = await json(`/api/signalements/${sid}/resoudre`, { method: 'PUT', body: '{}' });
    assert.equal(r.status, 400);
  });

  it('teste une valeur fictive contre une regle', async () => {
    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Vitek test', type: 'micro' })
    });
    const lot = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify(payload({ nom: 'LOT-2026-205', machine_id: machine.data.id }))
    });
    const regle = await json('/api/regles_alerte', {
      method: 'POST',
      body: JSON.stringify({
        lot_id: lot.data.id,
        parametre: 'CRP',
        seuil_haut: '5.0',
        unite: 'mg/L'
      })
    });
    const test = await json(`/api/regles_alerte/${regle.data.id}/tester`, {
      method: 'POST',
      body: JSON.stringify({ valeur: 12 })
    });
    assert.equal(test.status, 200);
    assert.equal(test.data.resultat, 'alerte');
  });
});
