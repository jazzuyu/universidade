const express = require('express');
const path = require('node:path');
const { sql, getPool } = require('./db');
const { HttpError, number, text, key, validateProgress } = require('./validation');

const select = `SELECT m.*, a.NOME AS ALUNO_NOME, d.NOME AS MATERIA_NOME,
  c.NOME AS CURSO_NOME, p.NOME AS PROFESSOR_NOME
  FROM dbo.MATRICULA m
  JOIN dbo.ALUNOS a ON a.MATRICULA = m.MATRICULA
  JOIN dbo.MATERIAS d ON d.SIGLA = m.MATERIA AND d.CURSO = m.CURSO
  JOIN dbo.CURSOS c ON c.CURSO = m.CURSO
  LEFT JOIN dbo.PROFESSOR p ON p.PROFESSOR = m.PROFESSOR`;
const where = 'm.MATRICULA = @MATRICULA AND m.CURSO = @CURSO AND m.MATERIA = @MATERIA AND m.PERLETIVO = @PERLETIVO';
function bind(request, values) {
  return request.input('MATRICULA', sql.Int, values.MATRICULA)
    .input('CURSO', sql.Char(3), values.CURSO)
    .input('MATERIA', sql.Char(3), values.MATERIA)
    .input('PERLETIVO', sql.Char(4), String(values.PERLETIVO));
}
function createApp(poolProvider = getPool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    next();
  });
  for (const [route, query] of [
    ['/alunos', 'SELECT MATRICULA, NOME FROM dbo.ALUNOS ORDER BY NOME, MATRICULA'],
    ['/cursos', 'SELECT CURSO, NOME FROM dbo.CURSOS ORDER BY NOME']
  ]) {
    app.get(route, async (req, res) => {
      const pool = await poolProvider();
      res.set('Cache-Control', 'no-store').json((await pool.request().query(query)).recordset);
    });
  }
  app.get(['/matriculas', '/matriculas/:matricula'], async (req, res) => {
    const matricula = req.params.matricula == null ? null : number(req.params.matricula, 'Matrícula', 1, 2147483647, true);
    const pool = await poolProvider();
    const request = pool.request();
    if (matricula != null) request.input('MATRICULA', sql.Int, matricula);
    const result = await request.query(`${select} ${matricula == null ? '' : 'WHERE m.MATRICULA = @MATRICULA'} ORDER BY a.NOME, m.PERLETIVO DESC, d.NOME`);
    res.set('Cache-Control', 'no-store').json(result.recordset);
  });
  app.post('/matricular', async (req, res) => {
    const nome = text(req.body?.NOME, 'Nome', 50);
    const curso = text(req.body?.CURSO, 'Curso', 3);
    const pool = await poolProvider();
    const result = await pool.request().input('NOME', sql.VarChar(50), nome)
      .input('CURSO', sql.Char(3), curso).execute('dbo.procMATRICULAALUNO');
    res.status(201).json({ message: 'Aluno matriculado com sucesso.', matriculas: result.recordset || [] });
  });
  for (const route of ['/notas', '/exame']) {
    app.post(route, async (req, res) => {
      const body = req.body || {};
      const values = key(body);
      const exame = route === '/exame';
      const nota = number(body[exame ? 'NOTAEXAME' : 'NOTA'], 'Nota', 0, 10);
      const bimestre = exame ? null : number(body.BIMESTRE, 'Bimestre', 1, 4, true);
      const falta = exame ? null : number(body.FALTA, 'Faltas', 0, 2147483647, true);
      const pool = await poolProvider();
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        // A trava cobre a validação e a execução da procedure na mesma conexão.
        const found = await bind(new sql.Request(transaction), values).query(`SELECT m.*,
          d.CARGAHORARIA FROM dbo.MATRICULA m WITH (UPDLOCK, HOLDLOCK)
          JOIN dbo.MATERIAS d ON d.SIGLA = m.MATERIA AND d.CURSO = m.CURSO WHERE ${where}`);
        if (!found.recordset.length) throw new HttpError(404, 'Matrícula não encontrada para esta matéria e período.');
        if (found.recordset.length !== 1) throw new HttpError(409, 'Há mais de um professor para esta matrícula. Revise o cadastro antes do lançamento.');
        const row = found.recordset[0];
        if (exame) {
          if (String(row.RESULTADO).trim() !== 'EXAME') throw new HttpError(409, 'O exame só pode ser lançado quando o resultado é EXAME.');
        } else {
          validateProgress(row, bimestre);
          if (!(row.CARGAHORARIA > 0)) throw new HttpError(409, 'A matéria deve ter carga horária positiva.');
          const total = [1, 2, 3, 4].reduce((sum, i) => sum + (i === bimestre ? falta : (row[`F${i}`] || 0)), 0);
          if (total > row.CARGAHORARIA) throw new HttpError(400, 'O total de faltas não pode superar a carga horária da matéria.');
        }
        const request = bind(new sql.Request(transaction), values);
        if (exame) request.input('NOTAEXAME', sql.Float, nota);
        else request.input('NOTA', sql.Float, nota).input('FALTA', sql.Int, falta).input('BIMESTRE', sql.Int, bimestre);
        await request.execute(exame ? 'dbo.sp_LancaExame' : 'dbo.sp_CadastraNotas');
        const updated = await bind(new sql.Request(transaction), values).query(`${select} WHERE ${where}`);
        await transaction.commit();
        res.json({ message: exame ? 'Exame lançado com sucesso.' : 'Nota e faltas lançadas com sucesso.', matriculas: updated.recordset });
      } catch (error) {
        try { await transaction.rollback(); } catch { /* Pode já ter sido revertida pelo SQL Server. */ }
        throw error;
      }
    });
  }
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(`[${req.method} ${req.path}]`, error.message);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande.' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    const number = error.number ?? error.originalError?.info?.number;
    if (number >= 50001 && number <= 50004) return res.status(400).json({ error: error.message });
    if ([2601, 2627, 547].includes(number)) return res.status(409).json({ error: 'Conflito no cadastro. Confira os dados relacionados.' });
    if (number === 2812) return res.status(503).json({ error: 'Procedure ausente. Execute npm run db:setup e confira as procedures existentes.' });
    if (['ETIMEOUT', 'ESOCKET', 'ELOGIN', 'EINSTLOOKUP', 'ECONNCLOSED', 'ECONNREFUSED', 'EDRIVER'].includes(error.code) || error.name === 'ConnectionError') {
      return res.status(503).json({ error: 'SQL Server indisponível. Confira o serviço SQLEXPRESS, o driver ODBC, as permissões Windows e o arquivo .env.' });
    }
    res.status(500).json({ error: 'Não foi possível concluir a operação. Consulte o terminal do servidor.' });
  });
  return app;
}
module.exports = { createApp };
