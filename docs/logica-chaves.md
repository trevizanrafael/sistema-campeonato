# Lógica de Chaves Eliminatórias e Lutas

## 1. Geração da chave

Uma chave só pode ser gerada quando há pelo menos **2 inscrições confirmadas** na categoria.

### Tamanho da chave (próxima potência de 2)

| Inscritos | Tamanho da chave |
|:---------:|:----------------:|
| 2 | 2 |
| 3 | 4 |
| 4 | 4 |
| 5–8 | 8 |
| 9–16 | 16 |
| 17–32 | 32 |

---

## 2. Criação das lutas

Para uma chave de tamanho 8:

| Rodada | Lutas | Significado |
|:------:|:-----:|-------------|
| 1 | 4 | Primeira fase |
| 2 | 2 | Semifinais |
| 3 | 1 | Final |

**Não salvamos** "semifinal" ou "final" como texto. É calculado:
- Maior rodada = Final
- Maior rodada − 1 = Semifinal

### Relacionamento entre lutas (chave de 8)

```
R1/P1 ──┐
         ├── R2/P1 (slot 1 e 2) ──┐
R1/P2 ──┘                          │
                                    ├── R3/P1 (FINAL)
R1/P3 ──┐                          │
         ├── R2/P2 (slot 1 e 2) ──┘
R1/P4 ──┘
```

Cada luta sabe para onde o vencedor vai:
```
proxima_luta_id = id da luta seguinte
proximo_slot = 1 ou 2 (qual posição na luta seguinte)
```

A **final** não tem próxima luta:
```
proxima_luta_id = NULL
proximo_slot = NULL
```

---

## 3. Status das lutas

| Status | Significado |
|--------|-------------|
| `AGUARDANDO` | Depende de resultados anteriores |
| `PRONTA` | Tem 2 competidores, pode ser realizada |
| `FINALIZADA` | Resultado lançado |
| `CANCELADA` | Anulada administrativamente |

---

## 4. Fluxo do avanço (após resultado)

Quando um resultado é salvo, **tudo em uma transação**:

```
1. Definir vencedor_id e perdedor_id
2. Marcar luta como FINALIZADA
3. Localizar proxima_luta_id
4. Verificar proximo_slot (1 ou 2)
5. Colocar vencedor no slot correspondente da próxima luta
6. Se próxima luta tem 2 competidores → status = PRONTA
```

---

## 5. Lógica do BYE

Se uma luta da primeira rodada tem apenas 1 competidor:

```
competidor_1_id = 10
competidor_2_id = NULL
vencedor_id = 10
perdedor_id = NULL
tipo_resultado = BYE
status = FINALIZADA
```

O competidor avança automaticamente. BYE normalmente **não gera pontos**, dependendo da config `bye_pontua`.

---

## 6. Status automático da chave

| Momento | Status da chave |
|---------|-----------------|
| Criada | `NAO_INICIADA` |
| Primeiro resultado lançado | `EM_ANDAMENTO` |
| Final concluída | `FINALIZADA` |

---

## 7. Pódio automático

Após a final:

```
primeiro_lugar_id = vencedor da final
segundo_lugar_id = perdedor da final
```

Para o terceiro:
1. Encontrar a semifinal cujo vencedor foi o **campeão**
2. O perdedor dessa semifinal = terceiro lugar

Se a chave tem apenas 2 participantes → `terceiro_lugar_id = NULL`

---

## 8. Edição manual do pódio

Quando o organizador altera o pódio manualmente:

```
colocacao_editada_manualmente = TRUE
colocacao_editada_por = id do usuário logado
colocacao_editada_em = NOW()
motivo_edicao_colocacao = "justificativa"
```

O Node.js deve validar que os 3 selecionados **pertencem à categoria da chave**.

A edição do pódio **recalcula apenas os pontos de colocação** (PRIMEIRO_LUGAR, SEGUNDO_LUGAR, TERCEIRO_LUGAR). Os pontos de vitória permanecem inalterados.
