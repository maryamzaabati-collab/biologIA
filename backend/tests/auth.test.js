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

let server;
let base;
let cookie = '';

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
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
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

    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot auth test' })
    });
    assert.equal(cree.status, 201);
  });

  it('interdit au technicien de valider un lot', async () => {
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot sans validation tech' })
    });
    const r = await json(`/api/lots/${cree.data.id}/validations`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(r.status, 403);
  });

  it('permet au biologiste de valider', async () => {
    cookie = '';
    const login = await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'amrani', mot_de_passe: 'labo2026' })
    });
    assert.equal(login.status, 200);

    cookie = '';
    await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'samira', mot_de_passe: 'labo2026' })
    });
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({ nom: 'Lot a valider' })
    });
    cookie = '';
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
});
