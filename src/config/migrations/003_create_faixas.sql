-- Migration 003: Tabela faixas
CREATE TABLE IF NOT EXISTS faixas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS faixas_nome_unique
ON faixas (LOWER(nome));

CREATE UNIQUE INDEX IF NOT EXISTS faixas_ordem_unique
ON faixas (ordem);
