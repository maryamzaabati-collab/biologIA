const crypto = require('crypto');

function googleConfigure() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  return { actif: Boolean(clientId && clientSecret), clientId, clientSecret, redirectUri };
}

function urlAutorisationGoogle(etat) {
  const { clientId, redirectUri } = googleConfigure();
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', etat);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

async function echangerCodeGoogle(code) {
  const { clientId, clientSecret, redirectUri } = googleConfigure();
  const corps = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const jeton = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corps
  });
  const data = await jeton.json();
  if (!jeton.ok) throw new Error(data.error_description || 'Échange Google impossible.');
  const profilRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` }
  });
  const profil = await profilRes.json();
  if (!profilRes.ok || !profil.email) throw new Error('Profil Google illisible.');
  return {
    google_id: String(profil.sub),
    email: String(profil.email).toLowerCase(),
    nom: profil.name || profil.email
  };
}

function etatAleatoire() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { googleConfigure, urlAutorisationGoogle, echangerCodeGoogle, etatAleatoire };
