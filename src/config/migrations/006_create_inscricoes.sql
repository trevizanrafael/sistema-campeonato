-- Migration 006: Tabela inscricoes
CREATE TABLE IF NOT EXISTS inscricoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    categoria_id BIGINT REFERENCES categorias(id) ON DELETE RESTRICT,
    equipe_id BIGINT NOT NULL REFERENCES equipes(id) ON DELETE RESTRICT,
    faixa_id BIGINT NOT NULL REFERENCES faixas(id) ON DELETE RESTRICT,
    nome VARCHAR(200) NOT NULL,
    idade INTEGER NOT NULL CHECK (idade >= 0),
    peso NUMERIC(6,2) NOT NULL CHECK (peso >= 0),
    sexo VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    seed INTEGER CHECK (seed IS NULL OR seed > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        sexo IS NULL
        OR sexo IN ('MASCULINO', 'FEMININO')
    ),

    CHECK (
        status IN (
            'PENDENTE',
            'CONFIRMADA',
            'CANCELADA',
            'DESCLASSIFICADA'
        )
    )
);

CREATE INDEX IF NOT EXISTS inscricoes_evento_idx
ON inscricoes (evento_id);

CREATE INDEX IF NOT EXISTS inscricoes_categoria_idx
ON inscricoes (categoria_id);

CREATE INDEX IF NOT EXISTS inscricoes_equipe_idx
ON inscricoes (equipe_id);
