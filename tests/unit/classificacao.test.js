const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  inscricaoCompativelComCategoria,
  buscarCategoriasCompativeis,
  buscarCategoriasDisponiveis,
  avisoChaveGerada,
  avisoChaveIniciada,
} = require('../../src/services/classificacaoService');

describe('Unit Tests: Classificação de Atletas e Categorias', () => {
  const categoriaPadrao = {
    id: 1,
    nome: 'Adulto Médio Branca a Azul Masculino',
    sexo: 'MASCULINO',
    idade_minima: 18,
    idade_maxima: 29,
    peso_minimo: 70.0,
    peso_maximo: 82.3,
    faixa_min_ordem: 1,
    faixa_max_ordem: 2,
  };

  it('deve aceitar atleta perfeitamente dentro de todos os critérios', () => {
    const atleta = {
      sexo: 'MASCULINO',
      idade: 25,
      peso: 76.5,
      faixa_ordem: 1,
    };
    assert.equal(inscricaoCompativelComCategoria(atleta, categoriaPadrao), true);
  });

  it('deve rejeitar atleta com sexo incompatível', () => {
    const atleta = {
      sexo: 'FEMININO',
      idade: 25,
      peso: 76.5,
      faixa_ordem: 1,
    };
    assert.equal(inscricaoCompativelComCategoria(atleta, categoriaPadrao), false);
  });

  it('deve aceitar qualquer sexo se a categoria for MISTO', () => {
    const catMista = { ...categoriaPadrao, sexo: 'MISTO' };
    const atletaM = { sexo: 'MASCULINO', idade: 25, peso: 75.0, faixa_ordem: 1 };
    const atletaF = { sexo: 'FEMININO', idade: 25, peso: 75.0, faixa_ordem: 1 };
    assert.equal(inscricaoCompativelComCategoria(atletaM, catMista), true);
    assert.equal(inscricaoCompativelComCategoria(atletaF, catMista), true);
  });

  it('deve respeitar limites exatos de idade (inclusivos)', () => {
    assert.equal(inscricaoCompativelComCategoria({ ...categoriaPadrao, idade: 18, faixa_ordem: 1, peso: 75 }, categoriaPadrao), true);
    assert.equal(inscricaoCompativelComCategoria({ ...categoriaPadrao, idade: 29, faixa_ordem: 1, peso: 75 }, categoriaPadrao), true);
    assert.equal(inscricaoCompativelComCategoria({ ...categoriaPadrao, idade: 17, faixa_ordem: 1, peso: 75 }, categoriaPadrao), false);
    assert.equal(inscricaoCompativelComCategoria({ ...categoriaPadrao, idade: 30, faixa_ordem: 1, peso: 75 }, categoriaPadrao), false);
  });

  it('deve respeitar regra de peso: mínimo exclusivo e máximo inclusivo', () => {
    // 70.0 kg é o mínimo da categoria -> deve ser rejeitado pois o mínimo é exclusivo (peso > peso_minimo)
    assert.equal(inscricaoCompativelComCategoria({ sexo: 'MASCULINO', idade: 20, peso: 70.0, faixa_ordem: 1 }, categoriaPadrao), false);
    // 70.01 kg deve ser aceito
    assert.equal(inscricaoCompativelComCategoria({ sexo: 'MASCULINO', idade: 20, peso: 70.01, faixa_ordem: 1 }, categoriaPadrao), true);
    // 82.3 kg é o máximo -> deve ser aceito (peso <= peso_maximo)
    assert.equal(inscricaoCompativelComCategoria({ sexo: 'MASCULINO', idade: 20, peso: 82.3, faixa_ordem: 1 }, categoriaPadrao), true);
    // 82.31 kg deve ser rejeitado
    assert.equal(inscricaoCompativelComCategoria({ sexo: 'MASCULINO', idade: 20, peso: 82.31, faixa_ordem: 1 }, categoriaPadrao), false);
  });

  it('deve filtrar corretamente entre múltiplas categorias com buscarCategoriasCompativeis', () => {
    const categorias = [
      { id: 10, nome: 'Pena', sexo: 'MASCULINO', idade_minima: 18, idade_maxima: null, peso_minimo: null, peso_maximo: 70.0, faixa_min_ordem: 1, faixa_max_ordem: 2 },
      { id: 20, nome: 'Médio', sexo: 'MASCULINO', idade_minima: 18, idade_maxima: null, peso_minimo: 70.0, peso_maximo: 82.3, faixa_min_ordem: 1, faixa_max_ordem: 2 },
      { id: 30, nome: 'Pesado', sexo: 'MASCULINO', idade_minima: 18, idade_maxima: null, peso_minimo: 82.3, peso_maximo: 95.0, faixa_min_ordem: 1, faixa_max_ordem: 2 },
    ];

    const atletaPena = { sexo: 'MASCULINO', idade: 20, peso: 70.0, faixa_ordem: 1 };
    const compPena = buscarCategoriasCompativeis(atletaPena, categorias);
    assert.equal(compPena.length, 1);
    assert.equal(compPena[0].id, 10);

    const atletaMedio = { sexo: 'MASCULINO', idade: 20, peso: 70.1, faixa_ordem: 1 };
    const compMedio = buscarCategoriasCompativeis(atletaMedio, categorias);
    assert.equal(compMedio.length, 1);
    assert.equal(compMedio[0].id, 20);
  });
});

describe('Unit Tests: Categorias com chave já gerada/iniciada', () => {
  const base = {
    sexo: 'MASCULINO', idade_minima: 18, idade_maxima: 30,
    peso_minimo: 60, peso_maximo: 80, faixa_minima_ordem: 1, faixa_maxima_ordem: 5,
  };
  const atleta = { sexo: 'MASCULINO', idade: 20, peso: 70, faixa_ordem: 2 };

  it('não oferece categorias com chave em andamento ou finalizada', () => {
    const categorias = [
      { ...base, id: 1, nome: 'Andamento', chave_status: 'EM_ANDAMENTO' },
      { ...base, id: 2, nome: 'Gerada', chave_status: 'NAO_INICIADA' },
      { ...base, id: 3, nome: 'Sem chave', chave_status: null },
      { ...base, id: 4, nome: 'Finalizada', chave_status: 'FINALIZADA' },
    ];

    const { disponiveis, bloqueadas } = buscarCategoriasDisponiveis(atleta, categorias);
    assert.deepEqual(disponiveis.map((c) => c.id), [2, 3]);
    assert.deepEqual(bloqueadas.map((c) => c.id), [1, 4]);
  });

  it('avisa para sortear novamente só quando a chave foi gerada e não começou', () => {
    assert.match(avisoChaveGerada({ nome: 'X', chave_status: 'NAO_INICIADA' }), /Sortear novamente/);
    assert.equal(avisoChaveGerada({ nome: 'X', chave_status: null }), null);
    assert.equal(avisoChaveGerada(null), null);
  });

  it('avisa quando o atleta ficou sem categoria por chave iniciada', () => {
    assert.equal(avisoChaveIniciada([]), null);
    assert.match(avisoChaveIniciada([{ nome: 'X' }]), /já começou/);
    assert.match(avisoChaveIniciada([{ nome: 'X' }, { nome: 'Y' }]), /já começaram/);
  });
});
