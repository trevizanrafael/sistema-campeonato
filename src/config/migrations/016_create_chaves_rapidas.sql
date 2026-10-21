-- Migration 016: Suporte a Chaves Rápidas
CREATE TABLE IF NOT EXISTS chaves_rapidas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NAO_INICIADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        status IN (
            'NAO_INICIADA',
            'EM_ANDAMENTO',
            'FINALIZADA'
        )
    )
);

CREATE INDEX IF NOT EXISTS chaves_rapidas_evento_idx
ON chaves_rapidas (evento_id);

CREATE TABLE IF NOT EXISTS inscricoes_chaves_rapidas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave_rapida_id BIGINT NOT NULL REFERENCES chaves_rapidas(id) ON DELETE CASCADE,
    inscricao_id BIGINT REFERENCES inscricoes(id) ON DELETE SET NULL,
    nome VARCHAR(200) NOT NULL,
    equipe_id BIGINT REFERENCES equipes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inscricoes_chaves_rapidas_chave_idx
ON inscricoes_chaves_rapidas (chave_rapida_id);

-- Permitir que chaves pertençam a uma categoria OU a uma chave rápida
ALTER TABLE chaves ALTER COLUMN categoria_id DROP NOT NULL;
ALTER TABLE chaves ADD COLUMN IF NOT EXISTS chave_rapida_id BIGINT REFERENCES chaves_rapidas(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS chaves_categoria_unique;
CREATE UNIQUE INDEX IF NOT EXISTS chaves_categoria_unique ON chaves (categoria_id) WHERE categoria_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chaves_rapida_unique ON chaves (chave_rapida_id) WHERE chave_rapida_id IS NOT NULL;

-- Permitir inscrições para chaves rápidas (faixa, idade, peso e equipe não obrigatórios)
ALTER TABLE inscricoes ALTER COLUMN faixa_id DROP NOT NULL;
ALTER TABLE inscricoes ALTER COLUMN idade DROP NOT NULL;
ALTER TABLE inscricoes ALTER COLUMN peso DROP NOT NULL;
ALTER TABLE inscricoes ALTER COLUMN equipe_id DROP NOT NULL;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS chave_rapida_id BIGINT REFERENCES chaves_rapidas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS inscricoes_chave_rapida_idx
ON inscricoes (chave_rapida_id);
