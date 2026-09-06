-- Migration 010: Tabela pontos_equipes
CREATE TABLE IF NOT EXISTS pontos_equipes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    equipe_id BIGINT NOT NULL REFERENCES equipes(id) ON DELETE RESTRICT,
    inscricao_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    luta_id BIGINT REFERENCES lutas(id) ON DELETE CASCADE,
    chave_id BIGINT REFERENCES chaves(id) ON DELETE CASCADE,

    tipo VARCHAR(30) NOT NULL,
    pontos INTEGER NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        tipo IN (
            'VITORIA',
            'PRIMEIRO_LUGAR',
            'SEGUNDO_LUGAR',
            'TERCEIRO_LUGAR',
            'AJUSTE',
            'PENALIDADE'
        )
    )
);

CREATE INDEX IF NOT EXISTS pontos_equipes_evento_idx
ON pontos_equipes (evento_id);

CREATE INDEX IF NOT EXISTS pontos_equipes_equipe_idx
ON pontos_equipes (equipe_id);
