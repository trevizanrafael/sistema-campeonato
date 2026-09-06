# Convenções Gerais do Banco de Dados

## Tipos padrão

| Uso | Tipo PostgreSQL |
|-----|-----------------|
| IDs | `BIGINT GENERATED ALWAYS AS IDENTITY` |
| Textos curtos | `VARCHAR(n)` |
| Descrições | `TEXT` |
| Datas e horas | `TIMESTAMPTZ` |
| Pesos | `NUMERIC(6,2)` |
| Pontos | `INTEGER` |

## Nomenclatura

- Chaves estrangeiras terminam em `_id` (ex: `evento_id`, `equipe_id`)
- Todas as tabelas possuem `created_at` e `updated_at`
- Nomes de tabelas e colunas em **português**, minúsculas, com underscores

## Colunas de auditoria

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

O PostgreSQL **não atualiza** `updated_at` automaticamente. A atualização é feita pelo Node.js em cada operação de edição.

## Índices case-insensitive

Sempre que um campo textual precisa ser único (email, nome de equipe, nome de faixa), usamos:

```sql
CREATE UNIQUE INDEX nome_do_indice
ON tabela (LOWER(coluna));
```

Isso garante que `"Equipe Alpha"`, `"EQUIPE ALPHA"` e `"equipe alpha"` sejam tratados como o mesmo valor.
