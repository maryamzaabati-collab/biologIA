const crypto = require('crypto');

function hasherMotDePasse(motDePasse, sel) {
  const selHex = sel || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(motDePasse), selHex, 32).toString('hex');
  return `${selHex}:${hash}`;
}

function verifierMotDePasse(motDePasse, stocke) {
  if (!stocke || !String(stocke).includes(':')) return false;
  const [sel, hash] = String(stocke).split(':');
  const candidat = crypto.scryptSync(String(motDePasse), sel, 32);
  const attendu = Buffer.from(hash, 'hex');
  if (candidat.length !== attendu.length) return false;
  return crypto.timingSafeEqual(candidat, attendu);
}

module.exports = { hasherMotDePasse, verifierMotDePasse };
