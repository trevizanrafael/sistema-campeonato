# Migrations e Seeds

## Como funciona

O sistema usa um runner próprio de migrations (`src/config/migrate.js`) que:

1. Cria uma tabela de controle `migrations` no banco
2. Lê todos os `.sql` da pasta `src/config/migrations/` em ordem alfabética
3. Pula os que já foram executados
4. Executa cada novo arquivo dentro de uma **transação**
5. Registra o nome do arquivo na tabela de controle

## Comandos

```bash
# Rodar todas as migrations pendentes
npm run migrate

# Criar o usuário administrador
npm run seed

# Fazer tudo de uma vez
npm run db:setup
```

## Pré-requisitos

1. PostgreSQL rodando
2. Banco criado:
   ```sql
   CREATE DATABASE sistema_campeonato;
   ```
3. `.env` configurado:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=sua_senha_real
   DB_NAME=sistema_campeonato
   ADMIN_EMAIL=admin@sistema.com
   ADMIN_PASSWORD=sua_senha_admin
   ```

## Ordem das migrations

A ordem importa porque tabelas referenciam outras que precisam existir antes.

| # | Arquivo | Dependências |
|---|---------|--------------|
| 001 | `create_usuarios` | nenhuma |
| 002 | `create_eventos` | nenhuma |
| 003 | `create_faixas` | nenhuma |
| 004 | `create_categorias` | eventos, faixas |
| 005 | `create_equipes` | nenhuma |
| 006 | `create_inscricoes` | eventos, categorias, equipes, faixas |
| 007 | `create_chaves` | categorias, inscricoes, usuarios |
| 008 | `create_lutas` | chaves, inscricoes, lutas (auto-ref) |
| 009 | `create_regras_pontuacao` | eventos |
| 010 | `create_pontos_equipes` | eventos, equipes, inscricoes, lutas, chaves |
| 011 | `create_indexes` | pontos_equipes |
| 012 | `create_seed_data` | faixas |

## Seed do administrador

O admin é criado por um script Node.js (`src/config/seed.js`) porque a senha precisa ser hasheada com bcrypt. O SQL **não** contém senhas.

```javascript
const senhaHash = await bcrypt.hash(senha, 12);
```

O script é **idempotente**: se o admin já existe, ele pula.

## Como adicionar novas migrations

1. Crie um arquivo na pasta `src/config/migrations/` com o próximo número:
   ```
   013_minha_nova_migration.sql
   ```
2. Rode `npm run migrate`
3. Apenas o novo arquivo será executado
