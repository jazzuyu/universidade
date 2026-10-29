# Universidade

Aplicação local com Node.js, Express, `mssql/msnodesqlv8` e HTML/CSS/JavaScript puros. Usa o banco **Universidade já existente**, sem recriar tabelas nem executar os exemplos de `Universidade.sql`.

## Executar no Windows

Requisitos: Node.js 22 ou superior (64 bits), Microsoft ODBC Driver 18 for SQL Server e serviço `SQL Server (SQLEXPRESS)` ativo. O usuário Windows que executa o Node precisa ter acesso ao banco, permissão de execução das procedures e leitura/escrita nas tabelas. Para instalar a nova procedure, precisa também de permissão de criação/alteração de procedures.

No PowerShell, dentro desta pasta:

```powershell
npm.cmd install
# O .env local já está preenchido. Para recriá-lo, se necessário:
# Copy-Item .env.example .env
npm.cmd run db:setup
npm.cmd run db:check
npm.cmd start
```

Abra **http://127.0.0.1:3000**. Para reinício automático durante desenvolvimento: `npm.cmd run dev`. Para testes: `npm.cmd test`.

O `.env` configura `DB_SERVER=localhost\SQLEXPRESS`, `DB_DATABASE=Universidade`, `DB_DRIVER=ODBC Driver 18 for SQL Server`, `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=true`, `HOST` e `PORT`. A autenticação é integrada do Windows (`Trusted_Connection=yes`), sem usuário/senha SQL. O servidor escuta apenas em loopback por padrão.

A procedure está em `sql/procMATRICULAALUNO.sql`; você também pode executá-la no SSMS conectado a `Universidade`. Ela usa uma transação, `SCOPE_IDENTITY()` e `INSERT ... SELECT` de todas as matérias do curso, com professor e **ano atual do SQL Server**. Cursos sem matérias ou com professor ausente/carga horária inválida são recusados sem deixar aluno parcial. Homônimos são permitidos e recebem matrículas diferentes. Não altera as duas procedures de notas existentes.

## API

Todas as respostas são JSON. Envie POST com `Content-Type: application/json`; erros retornam `{ "error": "mensagem" }` e status HTTP adequado.

| Método e rota | Dados / resposta |
| --- | --- |
| `GET /alunos` | Lista de alunos |
| `GET /cursos` | Lista de cursos |
| `GET /matriculas` | Todas as matérias matriculadas, com nomes de aluno, matéria, curso e professor |
| `GET /matriculas/:matricula` | Lista de matérias do aluno; lista vazia quando não houver vínculos |
| `POST /matricular` | `{ "NOME": "Maria Silva", "CURSO": "ENG" }` |
| `POST /notas` | `{ "MATRICULA": 1, "CURSO": "ENG", "MATERIA": "BDA", "PERLETIVO": 2026, "NOTA": 7.5, "FALTA": 2, "BIMESTRE": 1 }` |
| `POST /exame` | `{ "MATRICULA": 1, "CURSO": "ENG", "MATERIA": "BDA", "PERLETIVO": 2026, "NOTAEXAME": 6 }` |

Notas e exame aceitam valores de 0 a 10; faltas são inteiros não negativos e o total não pode superar a carga horária. Os bimestres devem ser lançados em ordem. Pode corrigir o último bimestre lançado antes do exame; correções de bimestres com lançamentos posteriores são bloqueadas porque a procedure existente não recalcula os períodos seguintes. Matrículas com exame concluído não aceitam alteração de notas. O exame exige resultado `EXAME` também no servidor. Os cálculos de média, frequência e resultado são realizados pelas procedures existentes.

## Problemas de conexão

Use `npm.cmd run db:check`. Confira o nome da instância, o serviço SQL Server, o driver ODBC e as permissões da conta Windows. Erros de SSPI (`Não é possível gerar contexto SSPI`) indicam falha da autenticação integrada no ambiente Windows/SQL Server; confira a conta e a configuração do serviço com o administrador. `TrustServerCertificate` resolve confiança de certificado TLS, mas não falhas de autenticação Windows. A documentação do [node-mssql](https://tediousjs.github.io/node-mssql/) descreve o driver `msnodesqlv8` e a autenticação integrada.

Os testes automatizados verificam validações e contratos HTTP sem gravar no banco. O acesso real é verificado separadamente por `db:check`.

Validação nesta entrega: sintaxe dos arquivos JavaScript e 3 testes de validação aprovados. A instalação das dependências foi impedida por `EACCES` no acesso ao registro npm; os testes HTTP e a interface no navegador não puderam ser executados. Uma tentativa de conexão integrada via cliente .NET retornou erro de contexto SSPI. A nova procedure foi entregue em arquivo e ainda precisa ser instalada com `db:setup` após resolver esses bloqueios.
