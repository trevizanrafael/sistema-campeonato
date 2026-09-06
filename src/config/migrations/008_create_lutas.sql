-- Migration 008: Tabela lutas
CREATE TABLE IF NOT EXISTS lutas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave_id BIGINT NOT NULL REFERENCES chaves(id) ON DELETE CASCADE,
    rodada INTEGER NOT NULL CHECK (rodada > 0),
    posicao INTEGER NOT NULL CHECK (posicao > 0),

    competidor_1_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    competidor_2_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    vencedor_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,
    perdedor_id BIGINT REFERENCES inscricoes(id) ON DELETE RESTRICT,

    proxima_luta_id BIGINT REFERENCES lutas(id) ON DELETE RESTRICT,
    proximo_slot INTEGER,

    status VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO',
    tipo_resultado VARCHAR(30),
    placar_1 INTEGER,
    placar_2 INTEGER,
    observacao TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        competidor_1_id IS NULL
        OR competidor_2_id IS NULL
        OR competidor_1_id <> competidor_2_id
    ),

    CHECK (
        vencedor_id IS NULL
        OR vencedor_id = competidor_1_id
        OR vencedor_id = competidor_2_id
    ),

    CHECK (
        perdedor_id IS NULL
        OR perdedor_id = competidor_1_id
        OR perdedor_id = competidor_2_id
    ),

    CHECK (
        vencedor_id IS NULL
        OR perdedor_id IS NULL
        OR vencedor_id <> perdedor_id
    ),

    CHECK (
        proximo_slot IS NULL
        OR proximo_slot IN (1, 2)
    ),

    CHECK (
        status IN (
            'AGUARDANDO',
            'PRONTA',
            'FINALIZADA',
            'CANCELADA'
        )
    ),

    CHECK (
        tipo_resultado IS NULL
        OR tipo_resultado IN (
            'PONTOS',
            'FINALIZACAO',
            'DECISAO',
            'WO',
            'DESCLASSIFICACAO',
            'BYE'
        )
    ),

    CHECK (placar_1 IS NULL OR placar_1 >= 0),
    CHECK (placar_2 IS NULL OR placar_2 >= 0),

    UNIQUE (chave_id, rodada, posicao)
);

CREATE INDEX IF NOT EXISTS lutas_chave_idx
ON lutas (chave_id);

CREATE INDEX IF NOT EXISTS lutas_proxima_luta_idx
ON lutas (proxima_luta_id);
