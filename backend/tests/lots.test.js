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

describe('routes lots', () => {
  it('refuse un lot sans nom', async () => {
    const { status, data } = await json('/api/lots', { method: 'POST', body: JSON.stringify({}) });
    assert.equal(status, 400);
    assert.match(data.erreur, /nom/i);
  });

  it('cree un lot douteux puis le corrige via PUT', async () => {
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot test glycémie' })
    });
    assert.equal(cree.status, 201);
    const id = cree.data.id;

    const detail = await json(`/api/lots/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.statut, 'douteux');
    assert.ok(detail.data.signalements.length > 0);

    const machine = await json('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Cobas test', type: 'biochimie' })
    });
    assert.equal(machine.status, 201);

    const maj = await json(`/api/lots/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nom: 'Lot test glycémie',
        machine_id: machine.data.id,
        date: '2024-03-01',
        conditions: 'calibration matin',
        anonymise: true
      })
    });
    assert.equal(maj.status, 200);

    const apres = await json(`/api/lots/${id}`);
    assert.equal(apres.data.statut, 'ok');
    assert.equal(apres.data.signalements.length, 0);
    assert.ok(apres.data.historique.length > 0);
  });

  it('renvoie 404 pour un lot inexistant', async () => {
    const { status, data } = await json(' /api/lots/99999'.trim());
    assert.equal(status, 404);
    assert.match(data.erreur, /existe pas/);
  });

  it('refuse la validation si le biologiste n est pas enregistre', async () => {
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot validation' })
    });
    const { status } = await json(`/api/lots/${cree.data.id}/validations`, {
      method: 'POST',
      body: JSON.stringify({ nom_biologiste: 'Inconnu Dupont' })
    });
    assert.equal(status, 400);
  });

  it('supprime un lot', async () => {
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot a supprimer' })
    });
    await json('/api/regles_alerte', {
      method: 'POST',
      body: JSON.stringify({
        lot_id: cree.data.id,
        parametre: 'Glycémie à jeun',
        seuil_bas: '0.70',
        seuil_haut: '1.10',
        unite: 'g/L'
      })
    });
    const suppr = await json(`/api/lots/${cree.data.id}`, { method: 'DELETE' });
    assert.equal(suppr.status, 200);
    const detail = await json(`/api/lots/${cree.data.id}`);
    assert.equal(detail.status, 404);
  });

  it('refuse de resoudre un signalement si le lot n est pas corrige', async () => {
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot encore incomplet' })
    });
    const detail = await json(`/api/lots/${cree.data.id}`);
    const sid = detail.data.signalements[0].id;
    const r = await json(`/api/signalements/${sid}/resoudre`, { method: 'PUT' });
    assert.equal(r.status, 400);
  });

  it('teste une valeur fictive contre une regle', async () => {
    const lot = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot simulateur' })
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
