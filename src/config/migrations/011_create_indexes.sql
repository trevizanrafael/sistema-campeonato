-- Migration 011: Índices de proteção contra duplicação de pontos
-- Garante que cada luta gere no máximo um lançamento de vitória
CREATE UNIQUE INDEX IF NOT EXISTS pontos_vitoria_unica
ON pontos_equipes (luta_id)
WHERE tipo = 'VITORIA';

-- Garante que cada chave gere no máximo um lançamento de primeiro lugar
CREATE UNIQUE INDEX IF NOT EXISTS pontos_primeiro_unico
ON pontos_equipes (chave_id)
WHERE tipo = 'PRIMEIRO_LUGAR';

-- Garante que cada chave gere no máximo um lançamento de segundo lugar
CREATE UNIQUE INDEX IF NOT EXISTS pontos_segundo_unico
ON pontos_equipes (chave_id)
WHERE tipo = 'SEGUNDO_LUGAR';

-- Garante que cada chave gere no máximo um lançamento de terceiro lugar
CREATE UNIQUE INDEX IF NOT EXISTS pontos_terceiro_unico
ON pontos_equipes (chave_id)
WHERE tipo = 'TERCEIRO_LUGAR';
