-- Migration 014: Tabela de logs de auditoria e índices essenciais

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    evento_id BIGINT REFERENCES eventos(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    entidade_id BIGINT,
    descricao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de auditoria
CREATE INDEX IF NOT EXISTS logs_auditoria_evento_idx
ON logs_auditoria (evento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS logs_auditoria_usuario_idx
ON logs_auditoria (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS logs_auditoria_entidade_idx
ON logs_auditoria (entidade, entidade_id);

CREATE INDEX IF NOT EXISTS logs_auditoria_evento_data_idx
ON logs_auditoria (evento_id, created_at DESC);

-- Índices de performance e integridade frequentes (Seção 18.27)
CREATE INDEX IF NOT EXISTS inscricoes_evento_status_idx
ON inscricoes (evento_id, status);

CREATE INDEX IF NOT EXISTS inscricoes_categoria_status_idx
ON inscricoes (categoria_id, status);

CREATE INDEX IF NOT EXISTS lutas_chave_rodada_idx
ON lutas (chave_id, rodada, posicao);

CREATE INDEX IF NOT EXISTS pontos_equipes_evento_equipe_idx
ON pontos_equipes (evento_id, equipe_id);
