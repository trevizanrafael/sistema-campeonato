# Regras de Validação: Banco vs. Node.js

O sistema usa **duas camadas** de validação:
- **PostgreSQL** impede dados obviamente inválidos (constraints, CHECKs)
- **Node.js** implementa regras de negócio mais complexas

## Mapa completo

| Regra | Banco (CHECK/FK/UNIQUE) | Node.js |
|-------|:-----------------------:|:-------:|
| E-mail único (case-insensitive) | ✅ UNIQUE INDEX | ✅ |
| Peso positivo | ✅ CHECK | ✅ |
| Idade positiva | ✅ CHECK | ✅ |
| Idade mínima ≤ máxima | ✅ CHECK | ✅ |
| Peso mínimo ≤ máximo | ✅ CHECK | ✅ |
| Sexo em valores válidos | ✅ CHECK | ✅ |
| Status de inscrição válido | ✅ CHECK | ✅ |
| Faixa mínima ≤ faixa máxima (por ordem) | ❌ | ✅ |
| Categoria pertence ao mesmo evento da inscrição | ❌ (FK parcial) | ✅ |
| Competidores pertencem à categoria da chave | ❌ | ✅ |
| Vencedor participou da luta | ✅ CHECK | ✅ |
| Perdedor participou da luta | ✅ CHECK | ✅ |
| Vencedor ≠ perdedor | ✅ CHECK | ✅ |
| Colocados pertencem à categoria da chave | ❌ | ✅ |
| Mesma pessoa não ocupa 2 colocações | ✅ CHECK | ✅ |
| Tamanho da chave é potência de 2 | ✅ CHECK | ✅ |
| Avanço do vencedor para próxima luta | ❌ | ✅ |
| Cálculo automático do terceiro lugar | ❌ | ✅ |
| Pontuação sem duplicação | ✅ UNIQUE parcial | ✅ |
| Recálculo de pontos após edição do pódio | ❌ | ✅ |
| Email salvo em minúsculas | ❌ | ✅ |
| Senha hasheada com bcrypt | ❌ | ✅ |
| Nome de equipe case-insensitive na importação | ❌ | ✅ |

## Por que duas camadas?

**Banco de dados** é a última barreira. Mesmo que o Node.js tenha um bug, o banco não vai aceitar dados inválidos.

**Node.js** implementa regras que exigem JOINs, cálculos entre tabelas, ou lógica condicional que o SQL puro não consegue expressar em CHECKs simples.

Exemplo: verificar que a `ordem` da faixa mínima é menor que a da faixa máxima requer consultar a tabela `faixas`, algo que um CHECK na tabela `categorias` não consegue fazer.
