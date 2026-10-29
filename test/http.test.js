const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

test('HTTP: listas, filtro parametrizado, cadastro e erros sem expor detalhes', async t => {
  const calls = [];
  let fail = false;
  const pool = { request() {
    const params = {};
    return {
      input(name, type, value) { params[name] = value; return this; },
      async query(query) {
        if (fail) throw Object.assign(new Error('detalhe interno sigiloso'), { name: 'ConnectionError' });
        calls.push({ query, params });
        return { recordset: [] };
      },
      async execute(procedure) { calls.push({ procedure, params }); return { recordset: [{ MATRICULA: 2 }] }; }
    };
  } };
  const server = createApp(async () => pool).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/alunos', '/cursos', '/matriculas', '/matriculas/1']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  }
  assert.equal(calls.at(-1).params.MATRICULA, 1);
  assert.match(calls.at(-1).query, /@MATRICULA/);
  assert.equal((await fetch(base + '/matriculas/1%27')).status, 400);
  const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/matricular', { NOME: 'Maria', CURSO: 'ENG' })).status, 201);
  assert.equal(calls.at(-1).procedure, 'dbo.procMATRICULAALUNO');
  assert.deepEqual(calls.at(-1).params, { NOME: 'Maria', CURSO: 'ENG' });
  for (const route of ['/notas', '/exame', '/matricular']) assert.equal((await post(route, {})).status, 400);
  const malformed = await fetch(base + '/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  fail = true;
  const unavailable = await fetch(base + '/alunos');
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(await unavailable.json()), /sigiloso/);
  assert.equal((await fetch(base + '/inexistente')).status, 404);
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Secretaria acadêmica/);
});
