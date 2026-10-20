function fusionnerCookies(actuel, reponse) {
  const map = {};
  for (const part of String(actuel || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const liste = typeof reponse.headers.getSetCookie === 'function'
    ? reponse.headers.getSetCookie()
    : [];
  for (const s of liste) {
    const kv = String(s).split(';')[0];
    const i = kv.indexOf('=');
    if (i > 0) map[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  return Object.entries(map).filter(([k, v]) => k && v).map(([k, v]) => `${k}=${v}`).join('; ');
}

function jetonCsrf(cookie) {
  const m = String(cookie || '').match(/labo_csrf=([^;]+)/);
  return m ? m[1] : '';
}

function creerJson(base, etat) {
  return async function json(chemin, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(etat.cookie ? { Cookie: etat.cookie } : {}),
      ...(options.headers || {})
    };
    const method = String(options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers['X-CSRF-Token']) {
      const tok = jetonCsrf(etat.cookie);
      if (tok) headers['X-CSRF-Token'] = tok;
    }
    const r = await fetch(`${base()}${chemin}`, { ...options, headers });
    etat.cookie = fusionnerCookies(etat.cookie, r);
    const type = r.headers.get('content-type') || '';
    const data = type.includes('json') ? await r.json().catch(() => ({})) : await r.text();
    return { status: r.status, data, headers: r.headers };
  };
}

module.exports = { fusionnerCookies, jetonCsrf, creerJson };
