const { test } = require('node:test');
const assert = require('node:assert/strict');
const { number, text, key, validateProgress } = require('../src/validation');

test('rejeita notas inválidas, campos vazios e faltas fracionadas', () => {
  for (const value of [undefined, null, '', ' ', true, [], -1, 11, Infinity, 'abc']) {
    assert.throws(() => number(value, 'Nota', 0, 10), { status: 400 });
  }
  assert.throws(() => number(1.5, 'Faltas', 0, 100, true), { status: 400 });
  assert.equal(number('7.5', 'Nota', 0, 10), 7.5);
  assert.equal(number(0, 'Nota', 0, 10), 0);
  assert.equal(number(10, 'Nota', 0, 10), 10);
});
test('valida nome e chave composta sem truncar os valores', () => {
  assert.equal(text('  Maria Silva  ', 'Nome', 50), 'Maria Silva');
  assert.throws(() => text('x'.repeat(51), 'Nome', 50), { status: 400 });
  assert.throws(() => key({ MATRICULA: 1, CURSO: 'ENGX', MATERIA: 'BDA', PERLETIVO: 2026 }), { status: 400 });
  assert.deepEqual(key({ MATRICULA: '1', CURSO: 'ENG', MATERIA: 'BDA', PERLETIVO: '2026' }), {
    MATRICULA: 1, CURSO: 'ENG', MATERIA: 'BDA', PERLETIVO: 2026
  });
});
test('exige sequência, mas permite corrigir o último bimestre', () => {
  assert.doesNotThrow(() => validateProgress({}, 1));
  assert.throws(() => validateProgress({}, 2), { status: 409 });
  assert.throws(() => validateProgress({ N1: 7, F1: null }, 2), { status: 409 });
  const row = { N1: 0, F1: 0, N2: 6, F2: 2 };
  assert.doesNotThrow(() => validateProgress(row, 2));
  assert.doesNotThrow(() => validateProgress(row, 3));
  assert.throws(() => validateProgress(row, 1), { status: 409 });
  assert.throws(() => validateProgress({ N1: 6, F1: 0, NOTAEXAME: 0 }, 1), { status: 409 });
});
