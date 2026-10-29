const { createApp } = require('./src/app');
const { closePool } = require('./src/db');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const server = createApp().listen(port, host, () => console.log(`Universidade: http://${host}:${port}`));
server.on('error', error => { console.error('Falha ao iniciar:', error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => {
    try { await closePool(); } finally { process.exit(0); }
  }));
}
