function ouvrirSqlite(chemin) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(chemin);
  } catch (err) {
    if (err.code !== 'ERR_UNKNOWN_BUILTIN_MODULE') throw err;
    const BetterSqlite = require('better-sqlite3');
    return new BetterSqlite(chemin);
  }
}

module.exports = { ouvrirSqlite };
