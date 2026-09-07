-- Migration 004: Tabela categorias
CREATE TABLE IF NOT EXISTS categorias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    idade_minima INTEGER,
    idade_maxima INTEGER,
    peso_minimo NUMERIC(6,2),
    peso_maximo NUMERIC(6,2),
    faixa_minima_id BIGINT REFERENCES faixas(id) ON DELETE RESTRICT,
    faixa_maxima_id BIGINT REFERENCES faixas(id) ON DELETE RESTRICT,
    sexo VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (idade_minima IS NULL OR idade_minima >= 0),
    CHECK (idade_maxima IS NULL OR idade_maxima >= 0),
    CHECK (
        idade_minima IS NULL
        OR idade_maxima IS NULL
        OR idade_minima <= idade_maxima
    ),

    CHECK (peso_minimo IS NULL OR peso_minimo >= 0),
    CHECK (peso_maximo IS NULL OR peso_maximo >= 0),
    CHECK (
        peso_minimo IS NULL
        OR peso_maximo IS NULL
        OR peso_minimo <= peso_maximo
    ),

    CHECK (
        sexo IS NULL
        OR sexo IN ('MASCULINO', 'FEMININO', 'MISTO')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS categorias_evento_nome_unique
ON categorias (evento_id, LOWER(nome));
