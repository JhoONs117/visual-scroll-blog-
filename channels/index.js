'use strict';

function tryRequire(mod) {
  try { return require(mod); }
  catch { process.stderr.write(`⚠️  channels: modulo "${mod}" non ancora disponibile (verrà creato in FASE 8)\n`); return null; }
}

const registry = {
  x:         tryRequire('./x'),
  instagram: tryRequire('./instagram'),
  tiktok:    tryRequire('./tiktok'),
};

// Rimuove le voci null (moduli non ancora creati)
Object.keys(registry).forEach(k => { if (registry[k] === null) delete registry[k]; });

module.exports = registry;
