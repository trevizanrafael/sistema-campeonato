-- Migration 007: Tabela chaves
CREATE TABLE IF NOT EXISTS chaves (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id BIGINT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    tamanho INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NAO_INICIADA',

    primeiro_lugar_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    segundo_lugar_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    terceiro_lugar_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,

    colocacao_editada_manualmente BOOLEAN NOT NULL DEFAULT FALSE,
    colocacao_editada_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    colocacao_editada_em TIMESTAMPTZ,
    motivo_edicao_colocacao TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (tamanho IN (2, 4, 8, 16, 32, 64, 128)),

    CHECK (
        status IN (
            'NAO_INICIADA',
            'EM_ANDAMENTO',
            'FINALIZADA'
        )
    ),

    CHECK (
        primeiro_lugar_id IS NULL
        OR segundo_lugar_id IS NULL
        OR primeiro_lugar_id <> segundo_lugar_id
    ),

    CHECK (
        primeiro_lugar_id IS NULL
        OR terceiro_lugar_id IS NULL
        OR primeiro_lugar_id <> terceiro_lugar_id
    ),

    CHECK (
        segundo_lugar_id IS NULL
        OR terceiro_lugar_id IS NULL
        OR segundo_lugar_id <> terceiro_lugar_id
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS chaves_categoria_unique
ON chaves (categoria_id);
