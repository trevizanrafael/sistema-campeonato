-- Migration 012: Dados iniciais (seed)
-- As faixas padrão do Jiu-Jitsu
INSERT INTO faixas (nome, ordem) VALUES
    ('Branca', 1),
    ('Azul', 2),
    ('Roxa', 3),
    ('Marrom', 4),
    ('Preta', 5)
ON CONFLICT DO NOTHING;

-- O usuário administrador é criado pelo script Node.js (seed.js)
-- porque a senha precisa ser hasheada com bcrypt.
