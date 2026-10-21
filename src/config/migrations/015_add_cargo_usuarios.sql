-- Migration 015: Cargos de usuário e último evento acessado
--
-- Cargos:
--   ADMINISTRADOR -> acesso total
--   ORGANIZADOR   -> eventos, equipes (academias) e toda a operação; sem usuários e faixas
--   OPERADOR      -> mesário: chaves, lançamento de resultados e ranking
--
-- Usuários já existentes viram ADMINISTRADOR para ninguém perder acesso.
-- Novos usuários nascem como OPERADOR (menor privilégio).

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS cargo VARCHAR(20) NOT NULL DEFAULT 'ADMINISTRADOR';

ALTER TABLE usuarios
    ALTER COLUMN cargo SET DEFAULT 'OPERADOR';

ALTER TABLE usuarios
    DROP CONSTRAINT IF EXISTS usuarios_cargo_check;

ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_cargo_check
    CHECK (cargo IN ('ADMINISTRADOR', 'ORGANIZADOR', 'OPERADOR'));

-- Último campeonato aberto pelo usuário (atalho da tela inicial)
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS ultimo_evento_id BIGINT NULL
    REFERENCES eventos(id) ON DELETE SET NULL;
