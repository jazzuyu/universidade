const { getPool, closePool } = require('../src/db');
(async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT DB_NAME() AS BANCO, SUSER_SNAME() AS USUARIO;
      SELECT name AS PROCEDURE_NAME FROM sys.procedures
      WHERE name IN ('sp_CadastraNotas', 'sp_LancaExame', 'procMATRICULAALUNO');`);
    for (const rows of result.recordsets) console.table(rows);
    if (result.recordsets[1].length !== 3) throw new Error('Uma ou mais procedures estão ausentes.');
  } catch (error) { console.error('Falha na verificação:', error.message); process.exitCode = 1; }
  finally { await closePool(); }
})();
