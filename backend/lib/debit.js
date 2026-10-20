const seaux = new Map();

function limiter({ fenetreMs = 60000, max = 20, cle }) {
  return (req, res, next) => {
    const id = cle(req);
    const now = Date.now();
    const s = seaux.get(id) || [];
    const recents = s.filter((t) => now - t < fenetreMs);
    recents.push(now);
    seaux.set(id, recents);
    if (recents.length > max) {
      return res.status(429).json({
        erreur: `Trop de requêtes. Réessayez dans ${Math.ceil(fenetreMs / 1000)} secondes.`
      });
    }
    next();
  };
}

module.exports = { limiter };
