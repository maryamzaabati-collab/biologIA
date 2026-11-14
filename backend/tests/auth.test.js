const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-auth-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../database');
require('../lib/alias-db');
const app = require('../application');
const { creerJson } = require('./http');

let server;
let base;
const etat = { cookie: '' };
let json;

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      json = creerJson(() => base, etat);
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

function resetCookie() {
  etat.cookie = '';
}

async function creerLotValide(nom) {
  const machines = await json('/api/machines');
  const ok = (machines.data || []).find((m) => m.statut_service !== 'maintenance' && m.statut_service !== 'hors_service' && !m.calibration_expiree);
  const mid = (ok || machines.data[0]).id;
  return json('/api/lots', {
    method: 'POST',
    body: JSON.stringify({
      nom,
      machine_id: mid,
      date: '2026-03-01',
      temperature: '21°C',
      lot_reactifs: 'R-441',
      calibration: 'matin',
      anonymise: true
    })
  });
}

describe('authentification', () => {
  it('refuse l API sans session', async () => {
    const { status } = await json('/api/lots');
    assert.equal(status, 401);
  });

  it('connecte un technicien et permet de creer un lot', async () => {
    const login = await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'samira', mot_de_passe: 'labo2026' })
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.role, 'technicien');

    const cree = await creerLotValide('LOT-2026-301');
    assert.equal(cree.status, 201);
  });

  it('interdit au technicien de valider un lot', async () => {
    const cree = await creerLotValide('LOT-2026-302');
    const r = await json(`/api/lots/${cree.data.id}/validations`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(r.status, 403);
  });

  it('permet au biologiste de valider', async () => {
    resetCookie();
    const login = await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'amrani', mot_de_passe: 'labo2026' })
    });
    assert.equal(login.status, 200);

    resetCookie();
    await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'samira', mot_de_passe: 'labo2026' })
    });
    const cree = await creerLotValide('LOT-2026-303');
    resetCookie();
    await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'amrani', mot_de_passe: 'labo2026' })
    });
    const val = await json(`/api/lots/${cree.data.id}/validations`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(val.status, 201);
    assert.match(val.data.nom_biologiste, /Amrani/);
  });

  it('refuse un e-mail sans point dans le domaine', async () => {
    resetCookie();
    for (const email of ['maryam@biol', 'mary@biologie']) {
      const r = await json('/api/auth/inscription', {
        method: 'POST',
        body: JSON.stringify({
          nom: 'Test',
          identifiant: 'u' + Math.random().toString(16).slice(2),
          email,
          mot_de_passe: 'labo2026x',
          role_demande: 'client'
        })
      });
      assert.equal(r.status, 400);
    }
  });

  it('interdit au technicien d archiver', async () => {
    resetCookie();
    await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'samira', mot_de_passe: 'labo2026' })
    });
    const cree = await creerLotValide('LOT-2026-304');
    const r = await json(`/api/lots/${cree.data.id}/archiver`, { method: 'POST', body: '{}' });
    assert.equal(r.status, 403);
  });
});
