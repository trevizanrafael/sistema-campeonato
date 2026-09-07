# Estrutura das Tabelas

## Diagrama de Relações

```
EVENTOS ──┬── CATEGORIAS ──── CHAVES ──── LUTAS
          │        │                        │
          │        └──── INSCRICOES ────────┘
          │                  │
          │              EQUIPES
          │                  │
          ├── REGRAS_PONTUACAO
          │
          └── PONTOS_EQUIPES
                   │
               EQUIPES

FAIXAS ──── INSCRICOES
       └─── CATEGORIAS

USUARIOS ── CHAVES (edição manual do pódio)
```

---

## 1. `usuarios`

Autenticação e identificação.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK auto-gerada |
| `nome` | VARCHAR(150) | ✅ | Nome do usuário |
| `email` | VARCHAR(255) | ✅ | Login (único, case-insensitive) |
| `senha_hash` | VARCHAR(255) | ✅ | Hash bcrypt (custo 12) |
| `ativo` | BOOLEAN | ✅ | `TRUE` = pode logar, `FALSE` = bloqueado |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

**Regras:**
- Email salvo em minúsculas
- Senha nunca salva em texto puro → sempre `bcrypt.hash(senha, 12)`
- Usuário inativo continua no banco mas não consegue logar

---

## 2. `eventos`

Cada campeonato ou competição.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `nome` | VARCHAR(200) | ✅ | Nome do evento |
| `descricao` | TEXT | ❌ | Informações livres |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

O evento é o **agrupador principal** de tudo: categorias, inscrições, chaves, lutas, regras e ranking.

---

## 3. `faixas`

Graduações com ordem hierárquica.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `nome` | VARCHAR(100) | ✅ | Nome da faixa |
| `ordem` | INTEGER | ✅ | Posição hierárquica (1 = menor) |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

**Dados iniciais (seed):**

| Faixa | Ordem |
|-------|:-----:|
| Branca | 1 |
| Azul | 2 |
| Roxa | 3 |
| Marrom | 4 |
| Preta | 5 |

**Por que usar `ordem`?** Comparar faixas pelo nome não funciona (`"Azul" < "Preta"` é alfabético, não hierárquico). O sistema sempre compara pela coluna `ordem`.

---

## 4. `categorias`

Critérios para agrupar competidores dentro de um evento.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `evento_id` | BIGINT | ✅ | FK → eventos |
| `nome` | VARCHAR(200) | ✅ | Nome exibido |
| `idade_minima` | INTEGER | ❌ | NULL = sem limite inferior |
| `idade_maxima` | INTEGER | ❌ | NULL = sem limite superior |
| `peso_minimo` | NUMERIC(6,2) | ❌ | NULL = sem limite inferior |
| `peso_maximo` | NUMERIC(6,2) | ❌ | NULL = sem limite superior |
| `faixa_minima_id` | BIGINT | ❌ | FK → faixas |
| `faixa_maxima_id` | BIGINT | ❌ | FK → faixas |
| `sexo` | VARCHAR(20) | ❌ | `MASCULINO`, `FEMININO`, `MISTO` ou NULL |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

**CHECKs no banco:** idades ≥ 0, pesos ≥ 0, mínimo ≤ máximo.

**Validação no Node.js:** ordem da faixa mínima ≤ ordem da faixa máxima (requer JOIN).

---

## 5. `equipes`

Academias ou equipes.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `nome` | VARCHAR(200) | ✅ | Único, case-insensitive |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

A equipe **não pertence a um evento**. A mesma equipe participa de vários campeonatos via inscrições.

---

## 6. `inscricoes`

Um competidor inscrito em um evento.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `evento_id` | BIGINT | ✅ | FK → eventos |
| `categoria_id` | BIGINT | ❌ | FK → categorias (preenchida depois) |
| `equipe_id` | BIGINT | ✅ | FK → equipes |
| `faixa_id` | BIGINT | ✅ | FK → faixas |
| `nome` | VARCHAR(200) | ✅ | Nome do competidor |
| `idade` | INTEGER | ✅ | Idade na competição |
| `peso` | NUMERIC(6,2) | ✅ | Peso na competição |
| `sexo` | VARCHAR(20) | ❌ | `MASCULINO` ou `FEMININO` |
| `status` | VARCHAR(30) | ✅ | `PENDENTE`, `CONFIRMADA`, `CANCELADA`, `DESCLASSIFICADA` |
| `seed` | INTEGER | ❌ | Posição preferencial no sorteio |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

---

## 7. `chaves`

Chave eliminatória de uma categoria.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `categoria_id` | BIGINT | ✅ | FK → categorias (única por categoria) |
| `nome` | VARCHAR(200) | ✅ | Nome da chave |
| `tamanho` | INTEGER | ✅ | 2, 4, 8, 16, 32, 64 ou 128 |
| `status` | VARCHAR(30) | ✅ | `NAO_INICIADA`, `EM_ANDAMENTO`, `FINALIZADA` |
| `primeiro_lugar_id` | BIGINT | ❌ | FK → inscricoes (campeão) |
| `segundo_lugar_id` | BIGINT | ❌ | FK → inscricoes (vice) |
| `terceiro_lugar_id` | BIGINT | ❌ | FK → inscricoes |
| `colocacao_editada_manualmente` | BOOLEAN | ✅ | Default `FALSE` |
| `colocacao_editada_por` | BIGINT | ❌ | FK → usuarios |
| `colocacao_editada_em` | TIMESTAMPTZ | ❌ | — |
| `motivo_edicao_colocacao` | TEXT | ❌ | Justificativa da edição |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

---

## 8. `lutas`

Tabela principal da lógica eliminatória.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `chave_id` | BIGINT | ✅ | FK → chaves |
| `rodada` | INTEGER | ✅ | Fase numérica (1 = primeira) |
| `posicao` | INTEGER | ✅ | Ordem dentro da rodada |
| `competidor_1_id` | BIGINT | ❌ | FK → inscricoes |
| `competidor_2_id` | BIGINT | ❌ | FK → inscricoes |
| `vencedor_id` | BIGINT | ❌ | FK → inscricoes |
| `perdedor_id` | BIGINT | ❌ | FK → inscricoes |
| `proxima_luta_id` | BIGINT | ❌ | FK → lutas (auto-referência) |
| `proximo_slot` | INTEGER | ❌ | 1 ou 2 |
| `status` | VARCHAR(30) | ✅ | `AGUARDANDO`, `PRONTA`, `FINALIZADA`, `CANCELADA` |
| `tipo_resultado` | VARCHAR(30) | ❌ | `PONTOS`, `FINALIZACAO`, `DECISAO`, `WO`, `DESCLASSIFICACAO`, `BYE` |
| `placar_1` | INTEGER | ❌ | Pontos do competidor 1 |
| `placar_2` | INTEGER | ❌ | Pontos do competidor 2 |
| `observacao` | TEXT | ❌ | — |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

**Constraint único:** `(chave_id, rodada, posicao)` — não pode ter duas lutas na mesma posição da mesma rodada.

---

## 9. `regras_pontuacao`

Configuração de pontos por evento (uma por evento).

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `evento_id` | BIGINT | ✅ | FK → eventos (UNIQUE) |
| `pontos_vitoria` | INTEGER | ✅ | Default 0 |
| `pontos_primeiro` | INTEGER | ✅ | Default 0 |
| `pontos_segundo` | INTEGER | ✅ | Default 0 |
| `pontos_terceiro` | INTEGER | ✅ | Default 0 |
| `bye_pontua` | BOOLEAN | ✅ | Default FALSE |
| `created_at` | TIMESTAMPTZ | ✅ | — |
| `updated_at` | TIMESTAMPTZ | ✅ | — |

---

## 10. `pontos_equipes`

Extrato/ledger de pontos (não guarda total, guarda cada lançamento).

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | BIGINT | ✅ | PK |
| `evento_id` | BIGINT | ✅ | FK → eventos |
| `equipe_id` | BIGINT | ✅ | FK → equipes |
| `inscricao_id` | BIGINT | ❌ | FK → inscricoes |
| `luta_id` | BIGINT | ❌ | FK → lutas |
| `chave_id` | BIGINT | ❌ | FK → chaves |
| `tipo` | VARCHAR(30) | ✅ | `VITORIA`, `PRIMEIRO_LUGAR`, `SEGUNDO_LUGAR`, `TERCEIRO_LUGAR`, `AJUSTE`, `PENALIDADE` |
| `pontos` | INTEGER | ✅ | Positivo ou negativo |
| `descricao` | TEXT | ❌ | — |
| `created_at` | TIMESTAMPTZ | ✅ | — |

**Índices anti-duplicação:** garantem no máximo 1 lançamento de VITORIA por luta, e 1 de cada colocação por chave.
