const $ = id => document.getElementById(id);
let enrollments = [];
let examRow = null;
let busy = false;
const format = value => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
const resultName = row => (row.RESULTADO || '').trim();
const rowKey = row => JSON.stringify([row.MATRICULA, row.CURSO, row.MATERIA, row.PROFESSOR, row.PERLETIVO]);
const payload = row => ({ MATRICULA: row.MATRICULA, CURSO: row.CURSO.trim(), MATERIA: row.MATERIA.trim(), PERLETIVO: row.PERLETIVO });

function notify(message, error = false) {
  $('message').textContent = message;
  $('message').classList.toggle('error', error);
  $('message').hidden = false;
}
async function api(url, data) {
  const response = await fetch(url, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}
function options(select, items, label, empty) {
  select.replaceChildren(new Option(empty, ''));
  for (const item of items) select.add(new Option(label(item), item.value));
  select.disabled = items.length === 0;
}
function selectedRow() { return enrollments.find(row => rowKey(row) === $('enrollment').value); }
function fillGrade() {
  const row = selectedRow();
  const term = $('term').value;
  $('grade').value = row?.[`N${term}`] ?? '';
  $('absences').value = row?.[`F${term}`] ?? '';
}
function selectGrade(row) {
  $('enrollment').value = rowKey(row);
  $('term').value = String([1, 2, 3, 4].find(i => row[`N${i}`] == null) || 4);
  fillGrade();
  $('grade-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('grade').focus({ preventScroll: true });
}
function cell(parent, content) {
  const td = document.createElement('td');
  td.textContent = content;
  parent.append(td);
  return td;
}
function detail(parent, title, subtitle) {
  const td = cell(parent, '');
  const strong = document.createElement('strong'); strong.textContent = title;
  const small = document.createElement('small'); small.textContent = subtitle;
  td.append(strong, small);
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const filtered = enrollments.filter(row => [row.MATRICULA, row.ALUNO_NOME, row.MATERIA_NOME, row.CURSO_NOME, row.PERLETIVO, row.RESULTADO]
    .some(value => String(value ?? '').toLocaleLowerCase('pt-BR').includes(query)));
  $('rows').replaceChildren();
  for (const row of filtered) {
    const tr = document.createElement('tr');
    detail(tr, row.ALUNO_NOME, `Matrícula ${row.MATRICULA}`);
    detail(tr, row.MATERIA_NOME, `${row.CURSO.trim()} · ${row.CURSO_NOME}`);
    cell(tr, row.PERLETIVO);
    for (let i = 1; i <= 4; i++) detail(tr, format(row[`N${i}`]), `${format(row[`F${i}`])} faltas`);
    for (const column of ['TOTALPONTOS', 'MEDIA', 'TOTALFALTAS']) cell(tr, format(row[column]));
    cell(tr, row.PERCFREQ == null ? '—' : `${format(row.PERCFREQ)}%`);
    cell(tr, format(row.NOTAEXAME)); cell(tr, format(row.MEDIAFINAL));
    const result = resultName(row);
    const badge = document.createElement('span');
    badge.className = `badge ${result === 'APROVADO' ? 'approved' : result === 'EXAME' ? 'exam' : result.startsWith('REPROVADO') ? 'failed' : 'pending'}`;
    badge.textContent = result || 'EM ANDAMENTO';
    cell(tr, '').append(badge);
    const actions = cell(tr, '');
    const grades = document.createElement('button'); grades.type = 'button'; grades.className = 'secondary'; grades.textContent = 'Notas';
    grades.disabled = busy; grades.addEventListener('click', () => selectGrade(row));
    const exam = document.createElement('button'); exam.type = 'button'; exam.textContent = 'Lançar exame';
    exam.disabled = busy || result !== 'EXAME';
    exam.title = result === 'EXAME' ? 'Lançar nota do exame' : 'Disponível apenas para resultado EXAME';
    exam.addEventListener('click', () => {
      examRow = row; $('exam-context').textContent = `${row.ALUNO_NOME} · ${row.MATERIA_NOME} · ${row.PERLETIVO}`;
      $('exam-grade').value = ''; $('exam-dialog').showModal(); $('exam-grade').focus();
    });
    actions.append(grades, exam); $('rows').append(tr);
  }
  if (!filtered.length) {
    const tr = document.createElement('tr'); const td = cell(tr, enrollments.length ? 'Nenhuma matrícula corresponde à busca.' : 'Nenhuma matrícula cadastrada. Comece matriculando um aluno.');
    td.colSpan = 15; td.className = 'empty'; $('rows').append(tr);
  }
}
async function load() {
  const [students, courses, rows] = await Promise.all([api('/alunos'), api('/cursos'), api('/matriculas')]);
  const previousCourse = $('course').value;
  const previous = $('enrollment').value;
  enrollments = rows;
  options($('course'), courses.map(c => ({ ...c, value: c.CURSO.trim() })), c => `${c.CURSO.trim()} · ${c.NOME}`, courses.length ? 'Selecione um curso' : 'Nenhum curso cadastrado');
  if (courses.some(c => c.CURSO.trim() === previousCourse)) $('course').value = previousCourse;
  options($('enrollment'), rows.map(r => ({ ...r, value: rowKey(r) })), r => `${r.MATRICULA} · ${r.ALUNO_NOME} · ${r.MATERIA_NOME} · ${r.PERLETIVO}`, rows.length ? 'Selecione uma matrícula' : 'Nenhuma matrícula cadastrada');
  if (rows.some(r => rowKey(r) === previous)) $('enrollment').value = previous;
  $('students-count').textContent = students.length;
  $('enrollments-count').textContent = rows.length;
  $('approved-count').textContent = rows.filter(r => resultName(r) === 'APROVADO').length;
  $('exam-count').textContent = rows.filter(r => resultName(r) === 'EXAME').length;
  render(); fillGrade();
}
async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { notify(error.message, true); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
    render();
  }
}
async function save(url, data, onSuccess) {
  const response = await api(url, data);
  onSuccess?.();
  notify(response.message);
  try { await load(); }
  catch (error) { notify(`${response.message} A atualização da lista falhou: ${error.message}`, true); }
}
$('enroll-form').addEventListener('submit', event => {
  event.preventDefault();
  run(() => save('/matricular', Object.fromEntries(new FormData(event.target)), () => event.target.reset()));
});
$('grade-form').addEventListener('submit', event => {
  event.preventDefault();
  const row = selectedRow();
  if (!row) return notify('Selecione uma matrícula.', true);
  run(() => save('/notas', { ...payload(row), ...Object.fromEntries(new FormData(event.target)) }));
});
$('exam-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!examRow) return;
  run(async () => {
    try { await save('/exame', { ...payload(examRow), NOTAEXAME: $('exam-grade').value }, () => $('exam-dialog').close()); }
    catch (error) { $('exam-dialog').close(); throw error; }
  });
});
$('cancel-exam').addEventListener('click', () => $('exam-dialog').close());
$('exam-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('refresh').addEventListener('click', () => run(async () => { await load(); notify('Dados atualizados.'); }));
$('search').addEventListener('input', render);
$('enrollment').addEventListener('change', () => { const row = selectedRow(); if (row) { $('term').value = String([1, 2, 3, 4].find(i => row[`N${i}`] == null) || 4); } fillGrade(); });
$('term').addEventListener('change', fillGrade);
$('current-year').textContent = new Date().getFullYear();
run(async () => {
  try { await load(); }
  catch (error) {
    $('course').replaceChildren(new Option('Não foi possível carregar os cursos', ''));
    $('enrollment').replaceChildren(new Option('Não foi possível carregar as matrículas', ''));
    throw error;
  }
});
