-- Migration 009: Tabela regras_pontuacao
CREATE TABLE IF NOT EXISTS regras_pontuacao (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    pontos_vitoria INTEGER NOT NULL DEFAULT 0,
    pontos_primeiro INTEGER NOT NULL DEFAULT 0,
    pontos_segundo INTEGER NOT NULL DEFAULT 0,
    pontos_terceiro INTEGER NOT NULL DEFAULT 0,
    bye_pontua BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (pontos_vitoria >= 0),
    CHECK (pontos_primeiro >= 0),
    CHECK (pontos_segundo >= 0),
    CHECK (pontos_terceiro >= 0),

    UNIQUE (evento_id)
);
