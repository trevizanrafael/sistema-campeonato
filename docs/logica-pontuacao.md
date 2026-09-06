# Sistema de Pontuação e Ranking

## Configuração por evento (`regras_pontuacao`)

Cada evento tem **uma única** configuração de pontos:

```
pontos_vitoria:  1     (por cada luta vencida)
pontos_primeiro: 9     (adicional para o campeão)
pontos_segundo:  3     (adicional para o vice)
pontos_terceiro: 1     (adicional para o terceiro)
bye_pontua:      false (bye não conta como vitória)
```

**Pontuação é adicional**, não total. O campeão recebe:
```
pontos pelas vitórias + pontos pela colocação
```

---

## Extrato de pontos (`pontos_equipes`)

Não guardamos um total na equipe. Guardamos **cada lançamento individual** (ledger):

### Tipos de lançamento

| Tipo | Quando é criado |
|------|-----------------|
| `VITORIA` | Luta finalizada (1 por luta, máximo) |
| `PRIMEIRO_LUGAR` | Chave finalizada (1 por chave) |
| `SEGUNDO_LUGAR` | Chave finalizada (1 por chave) |
| `TERCEIRO_LUGAR` | Chave finalizada (1 por chave) |
| `AJUSTE` | Correção manual pelo organizador |
| `PENALIDADE` | Punição (pontos negativos) |

### Proteção contra duplicação

Índices parciais no banco garantem:
- No máximo **1 VITORIA por luta**
- No máximo **1 de cada colocação por chave**

---

## Fluxo: pontos por vitória

```
Luta finalizada
     │
     ▼
Identificar vencedor e sua equipe
     │
     ▼
Verificar se resultado é BYE
     │
     ├── BYE + bye_pontua = FALSE → não pontua
     └── Vitória normal (ou BYE + bye_pontua = TRUE)
              │
              ▼
         Criar lançamento:
         tipo = VITORIA
         pontos = regras.pontos_vitoria
         luta_id = id da luta
         inscricao_id = id do vencedor
         equipe_id = equipe do vencedor
```

---

## Fluxo: pontos por colocação

```
Chave finalizada (final concluída)
     │
     ▼
Criar 3 lançamentos:
     ├── PRIMEIRO_LUGAR → pontos_primeiro → equipe do campeão
     ├── SEGUNDO_LUGAR  → pontos_segundo  → equipe do vice
     └── TERCEIRO_LUGAR → pontos_terceiro → equipe do terceiro
```

---

## Recálculo após edição do pódio

Quando o pódio é editado manualmente:

```
1. BEGIN transação
2. DELETE lançamentos de colocação da chave
   (PRIMEIRO_LUGAR, SEGUNDO_LUGAR, TERCEIRO_LUGAR)
3. UPDATE colocados na tabela chaves
4. INSERT novos lançamentos de colocação
5. COMMIT
```

Os pontos de **vitórias não são alterados**.

---

## Consulta do ranking

```sql
SELECT
    e.id,
    e.nome,
    COALESCE(SUM(pe.pontos), 0) AS total_pontos
FROM equipes e
JOIN pontos_equipes pe ON pe.equipe_id = e.id
WHERE pe.evento_id = $1
GROUP BY e.id, e.nome
ORDER BY total_pontos DESC, e.nome;
```

O ranking é sempre **calculado em tempo real** a partir do extrato.
