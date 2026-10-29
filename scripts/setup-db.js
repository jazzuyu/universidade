const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool, closePool } = require('../src/db');
(async () => {
  try {
    const pool = await getPool();
    const source = await fs.readFile(path.join(__dirname, '../sql/procMATRICULAALUNO.sql'), 'utf8');
    for (const batch of source.split(/^\s*GO\s*\r?$/gim).filter(s => s.trim())) {
      await pool.request().batch(batch);
    }
    console.log('Procedure dbo.procMATRICULAALUNO instalada. Tabelas e dados existentes preservados.');
  } catch (error) { console.error('Falha ao instalar procedure:', error.message); process.exitCode = 1; }
  finally { await closePool(); }
})();
