class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function number(value, label, min, max, integer = false) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new HttpError(400, `${label} é obrigatório.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new HttpError(400, `${label} deve ser ${integer ? 'inteiro ' : ''}entre ${min} e ${max}.`);
  }
  return parsed;
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x1f]/.test(value)) {
    throw new HttpError(400, `${label} é obrigatório e deve ter até ${max} caracteres.`);
  }
  return value.trim();
}
function key(body) {
  return {
    MATRICULA: number(body.MATRICULA, 'Matrícula', 1, 2147483647, true),
    CURSO: text(body.CURSO, 'Curso', 3),
    MATERIA: text(body.MATERIA, 'Matéria', 3),
    PERLETIVO: number(body.PERLETIVO, 'Período letivo', 1000, 9999, true)
  };
}
function validateProgress(row, bimestre) {
  for (let i = 1; i < bimestre; i++) {
    if (row[`N${i}`] == null || row[`F${i}`] == null) {
      throw new HttpError(409, `Lance primeiro o ${i}º bimestre.`);
    }
  }
  for (let i = bimestre + 1; i <= 4; i++) {
    if (row[`N${i}`] != null || row[`F${i}`] != null) {
      throw new HttpError(409, 'Não é possível alterar um bimestre com bimestres posteriores lançados.');
    }
  }
  if (row.NOTAEXAME != null) throw new HttpError(409, 'O exame desta matrícula já foi concluído.');
}
module.exports = { HttpError, number, text, key, validateProgress };
