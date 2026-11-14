const path = require('path');

const absDb = path.resolve(__dirname, '..', 'db.js');
const absDatabase = require.resolve('../database');
if (require.cache[absDatabase]) {
  require.cache[absDb] = require.cache[absDatabase];
}

module.exports = absDb;
