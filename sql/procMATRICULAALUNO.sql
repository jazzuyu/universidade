USE [Universidade];
GO
CREATE OR ALTER PROCEDURE dbo.procMATRICULAALUNO
    @NOME VARCHAR(50),
    @CURSO CHAR(3)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @NOME = LTRIM(RTRIM(@NOME));
    IF @NOME IS NULL OR @NOME = ''
        THROW 50001, 'Informe o nome do aluno.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM dbo.CURSOS WITH (HOLDLOCK) WHERE CURSO = @CURSO)
            THROW 50002, 'Curso não encontrado.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.MATERIAS WITH (HOLDLOCK) WHERE CURSO = @CURSO)
            THROW 50003, 'O curso não possui matérias cadastradas.', 1;
        IF EXISTS (SELECT 1 FROM dbo.MATERIAS WITH (HOLDLOCK)
                   WHERE CURSO = @CURSO AND (PROFESSOR IS NULL OR CARGAHORARIA <= 0))
            THROW 50004, 'Todas as matérias do curso devem ter professor e carga horária positiva.', 1;

        INSERT INTO dbo.ALUNOS (NOME) VALUES (@NOME);
        DECLARE @MATRICULA INT = CONVERT(INT, SCOPE_IDENTITY());
        DECLARE @PERLETIVO INT = YEAR(GETDATE());

        -- Notas e faltas ficam NULL até o lançamento do respectivo bimestre.
        INSERT INTO dbo.MATRICULA (MATRICULA, CURSO, MATERIA, PROFESSOR, PERLETIVO)
        SELECT @MATRICULA, CURSO, SIGLA, PROFESSOR, @PERLETIVO
        FROM dbo.MATERIAS WITH (HOLDLOCK)
        WHERE CURSO = @CURSO;

        COMMIT TRANSACTION;
        SELECT * FROM dbo.MATRICULA WHERE MATRICULA = @MATRICULA;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
