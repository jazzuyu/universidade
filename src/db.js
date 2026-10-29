require('dotenv').config({ quiet: true });
const sql = require('mssql/msnodesqlv8');

// Chaves ODBC usam yes/no; as credenciais são as do processo Windows.
const quote = value => `{${String(value).replace(/}/g, '}}')}}`;
const yesNo = (value, fallback) => String(value ?? fallback).toLowerCase() === 'true' ? 'yes' : 'no';
const connectionString = [
  `Driver=${quote(process.env.DB_DRIVER || 'ODBC Driver 18 for SQL Server')}`,
  `Server=${quote(process.env.DB_SERVER || 'localhost\\SQLEXPRESS')}`,
  `Database=${quote(process.env.DB_DATABASE || 'Universidade')}`,
  'Trusted_Connection=yes',
  `Encrypt=${yesNo(process.env.DB_ENCRYPT, true)}`,
  `TrustServerCertificate=${yesNo(process.env.DB_TRUST_SERVER_CERTIFICATE, true)}`
].join(';') + ';';

let pending;
function getPool() {
  if (!pending) {
    const pool = new sql.ConnectionPool({ connectionString, connectionTimeout: 10000,
      requestTimeout: 15000, pool: { max: 10, min: 0, idleTimeoutMillis: 30000 } });
    pool.on('error', error => console.error('Pool SQL Server:', error.message));
    pending = pool.connect().catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
async function closePool() {
  if (pending) { const pool = await pending; pending = undefined; await pool.close(); }
}
module.exports = { sql, getPool, closePool };
