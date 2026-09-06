# Lógica de Categorização Automática

## Fluxo

Quando uma inscrição é criada, o sistema tenta encontrar automaticamente a categoria adequada.

```
Inscrição criada (sem categoria)
       │
       ▼
Buscar categorias do mesmo evento
       │
       ▼
Filtrar por: idade, peso, faixa, sexo
       │
       ├── 0 compatíveis → inscrição fica PENDENTE
       ├── 1 compatível  → associação automática
       └── 2+ compatíveis → usuário escolhe manualmente
```

## Regras de filtragem

Cada critério da categoria é verificado. **Limite NULL = sem restrição**.

```javascript
const categoriasCompativeis = categorias.filter((cat) => {

  // Idade: verificar se está dentro do range
  const idadeOk =
    (cat.idade_minima === null || inscricao.idade >= cat.idade_minima) &&
    (cat.idade_maxima === null || inscricao.idade <= cat.idade_maxima);

  // Peso: verificar se está dentro do range
  const pesoOk =
    (cat.peso_minimo === null || inscricao.peso >= cat.peso_minimo) &&
    (cat.peso_maximo === null || inscricao.peso <= cat.peso_maximo);

  // Faixa: comparar pela ORDEM, não pelo nome
  const faixaOk =
    (cat.faixa_minima_ordem === null || inscricao.faixa_ordem >= cat.faixa_minima_ordem) &&
    (cat.faixa_maxima_ordem === null || inscricao.faixa_ordem <= cat.faixa_maxima_ordem);

  // Sexo: NULL ou MISTO aceita qualquer um
  const sexoOk =
    cat.sexo === null ||
    cat.sexo === 'MISTO' ||
    cat.sexo === inscricao.sexo;

  return idadeOk && pesoOk && faixaOk && sexoOk;
});
```

## Exemplos

### Categoria: "Azul/Roxa Leve Masculino"
```
idade_minima: 18    idade_maxima: 30
peso_minimo: 64.00  peso_maximo: 76.00
faixa_minima: Azul (ordem 2)  faixa_maxima: Roxa (ordem 3)
sexo: MASCULINO
```

**Inscrição:** João, 25 anos, 70kg, Azul, Masculino → ✅ compatível  
**Inscrição:** Maria, 22 anos, 65kg, Azul, Feminino → ❌ sexo incompatível  
**Inscrição:** Pedro, 25 anos, 80kg, Azul, Masculino → ❌ peso acima do máximo

### Limites nulos
```
peso_minimo: NULL   peso_maximo: 60.00
```
Significa **qualquer peso até 60kg** (sem limite inferior).

## Proteção importante

O Node.js **deve validar** que a categoria selecionada pertence ao **mesmo evento** da inscrição. A FK sozinha não garante isso:

```javascript
if (categoria.evento_id !== inscricao.evento_id) {
  throw new Error('Categoria não pertence ao evento da inscrição');
}
```
