/**
 * Inscrição por documento (planilha .xlsx).
 *
 * Fluxo: o usuário escolhe a academia, envia uma planilha com as colunas
 * Nome, Peso, Faixa, Idade e Sexo e o sistema cadastra todos os atletas de uma vez.
 *
 * Regras:
 * - Tudo ou nada: se qualquer linha tiver erro, nenhuma inscrição é gravada
 *   (evita duplicar atletas quando a planilha corrigida for reenviada).
 * - Classificação: 1 categoria compatível -> CONFIRMADA;
 *   nenhuma ou mais de uma -> PENDENTE (resolver depois na tela de inscrições).
 */

const ExcelJS = require('exceljs');
const pool = require('../config/database');
const inscricaoRepository = require('../repositories/inscricaoRepository');
const eventoRepository = require('../repositories/eventoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const faixaRepository = require('../repositories/faixaRepository');
const equipeRepository = require('../repositories/equipeRepository');
const {
  normalizarInscricao,
  validarInscricao,
  validarId,
} = require('../validators/inscricaoValidator');
const {
  buscarCategoriasDisponiveis,
  chaveGeradaNaoIniciada,
} = require('./classificacaoService');
const { NotFoundError, ValidationError } = require('../utils/errors');
const auditoriaService = require('./auditoriaService');

const LIMITE_LINHAS = 500;
const NOME_ABA_MODELO = 'Inscrições';

// Ordem das colunas na planilha modelo. Os apelidos permitem que planilhas
// feitas "na mão" (ex.: "Peso (kg)", "Graduação") também sejam aceitas.
const COLUNAS = [
  { chave: 'nome', titulo: 'Nome', apelidos: ['nome', 'nome completo', 'atleta', 'competidor', 'nome do atleta', 'nome do competidor'] },
  { chave: 'peso', titulo: 'Peso', apelidos: ['peso', 'peso kg', 'kg'] },
  { chave: 'faixa', titulo: 'Faixa', apelidos: ['faixa', 'graduacao'] },
  { chave: 'idade', titulo: 'Idade', apelidos: ['idade', 'anos', 'idade anos'] },
  { chave: 'sexo', titulo: 'Sexo', apelidos: ['sexo', 'genero'] },
];

const SEXOS = {
  m: 'MASCULINO',
  masc: 'MASCULINO',
  masculino: 'MASCULINO',
  h: 'MASCULINO',
  homem: 'MASCULINO',
  f: 'FEMININO',
  fem: 'FEMININO',
  feminino: 'FEMININO',
  mulher: 'FEMININO',
};

const EXEMPLOS = [
  { nome: 'João da Silva', peso: 76.5, faixa: 'Azul', idade: 22, sexo: 'M' },
  { nome: 'Maria Oliveira', peso: 58, faixa: 'Branca', idade: 17, sexo: 'F' },
  { nome: 'Pedro Santos', peso: 34.2, faixa: 'Branca', idade: 10, sexo: 'M' },
];

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizarNomePessoa(nome) {
  return normalizarTexto(nome);
}

/** Extrai o valor "visível" de uma célula do ExcelJS (texto rico, fórmula, link...). */
function extrairValor(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'boolean') return String(valor);
  if (valor instanceof Date) return '';

  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join('').trim();
    }
    if ('result' in valor) return extrairValor(valor.result);
    if ('text' in valor) return extrairValor(valor.text);
    if ('error' in valor) return '';
  }

  return String(valor).trim();
}

function textoExibicao(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  return String(valor);
}

// ---------------------------------------------------------------------------
// Carregamento de dados
// ---------------------------------------------------------------------------

async function validarEventoExistente(eventoId, client = pool) {
  const id = validarId(eventoId);
  if (!id) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const evento = await eventoRepository.buscarPorId(id, client);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  return evento;
}

async function prepararPagina(eventoId) {
  const evento = await validarEventoExistente(eventoId);
  const equipes = await equipeRepository.listarTodas();

  return { evento, equipes };
}

// ---------------------------------------------------------------------------
// Planilha modelo
// ---------------------------------------------------------------------------

async function gerarModelo() {
  const faixas = await faixaRepository.listarTodas();
  const nomesFaixas = faixas.map((f) => f.nome);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Campeonato';
  workbook.created = new Date();

  // --- Aba principal ---
  const aba = workbook.addWorksheet(NOME_ABA_MODELO, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  aba.columns = [
    { header: 'Nome', key: 'nome', width: 38 },
    { header: 'Peso', key: 'peso', width: 12 },
    { header: 'Faixa', key: 'faixa', width: 16 },
    { header: 'Idade', key: 'idade', width: 10 },
    { header: 'Sexo', key: 'sexo', width: 10 },
  ];

  const cabecalho = aba.getRow(1);
  cabecalho.height = 22;
  cabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
    celula.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  EXEMPLOS.forEach((exemplo) => aba.addRow(exemplo));

  aba.getColumn('peso').numFmt = '0.0#';
  aba.getColumn('idade').numFmt = '0';

  // Listas suspensas para evitar erros de digitação (até a linha 501)
  const ultimaLinha = LIMITE_LINHAS + 1;
  for (let linha = 2; linha <= ultimaLinha; linha++) {
    if (nomesFaixas.length > 0) {
      aba.getCell(`C${linha}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${nomesFaixas.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Faixa inválida',
        error: `Use uma destas faixas: ${nomesFaixas.join(', ')}`,
      };
    }
    aba.getCell(`E${linha}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"M,F"'],
      showErrorMessage: true,
      errorTitle: 'Sexo inválido',
      error: 'Use M (masculino) ou F (feminino).',
    };
  }

  // --- Aba de instruções ---
  const instrucoes = workbook.addWorksheet('Como preencher');
  instrucoes.getColumn(1).width = 16;
  instrucoes.getColumn(2).width = 80;

  const linhasInstrucao = [
    ['Como preencher', ''],
    ['', ''],
    ['Nome', 'Nome completo do atleta.'],
    ['Peso', 'Peso em kg. Aceita vírgula ou ponto (ex.: 76,5).'],
    ['Faixa', `Uma destas: ${nomesFaixas.join(', ') || '(nenhuma faixa cadastrada)'}.`],
    ['Idade', 'Idade em anos, número inteiro (ex.: 22).'],
    ['Sexo', 'M para masculino ou F para feminino.'],
    ['', ''],
    ['Dicas', 'Apague as linhas de exemplo antes de enviar.'],
    ['', 'Uma linha por atleta. Linhas em branco são ignoradas.'],
    ['', `Máximo de ${LIMITE_LINHAS} atletas por planilha.`],
    ['', 'A academia é escolhida no sistema, na hora do envio.'],
  ];

  linhasInstrucao.forEach((valores) => instrucoes.addRow(valores));
  instrucoes.getRow(1).font = { bold: true, size: 14 };
  [3, 4, 5, 6, 7, 9].forEach((n) => {
    instrucoes.getCell(`A${n}`).font = { bold: true };
  });

  return workbook.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Leitura da planilha enviada
// ---------------------------------------------------------------------------

/** Procura a linha de cabeçalho nas 10 primeiras linhas de uma aba. */
function localizarCabecalho(aba) {
  const limite = Math.min(aba.rowCount, 10);

  for (let numero = 1; numero <= limite; numero++) {
    const linha = aba.getRow(numero);
    const mapa = {};

    linha.eachCell({ includeEmpty: false }, (celula, coluna) => {
      const texto = normalizarTexto(extrairValor(celula.value));
      const definicao = COLUNAS.find((c) => c.apelidos.includes(texto));
      if (definicao && !mapa[definicao.chave]) {
        mapa[definicao.chave] = coluna;
      }
    });

    const encontradas = Object.keys(mapa).length;
    if (mapa.nome && encontradas >= 3) {
      return { numero, mapa };
    }
  }

  return null;
}

async function lerPlanilha(buffer) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch (_) {
    throw new ValidationError({
      arquivo:
        'Não foi possível ler o arquivo. Envie uma planilha .xlsx válida (baixe a planilha modelo se tiver dúvida).',
    });
  }

  let aba = null;
  let cabecalho = null;

  for (const candidata of workbook.worksheets) {
    const encontrado = localizarCabecalho(candidata);
    if (encontrado) {
      aba = candidata;
      cabecalho = encontrado;
      break;
    }
  }

  if (!cabecalho) {
    throw new ValidationError({
      arquivo:
        'Não encontramos o cabeçalho da planilha. A primeira linha deve ter as colunas: Nome, Peso, Faixa, Idade e Sexo.',
    });
  }

  const faltando = COLUNAS.filter((c) => !cabecalho.mapa[c.chave]).map((c) => c.titulo);
  if (faltando.length > 0) {
    throw new ValidationError({
      arquivo: `Coluna(s) obrigatória(s) não encontrada(s): ${faltando.join(', ')}. Use a planilha modelo.`,
    });
  }

  const linhas = [];
  for (let numero = cabecalho.numero + 1; numero <= aba.rowCount; numero++) {
    const linha = aba.getRow(numero);
    const bruto = { linha: numero };

    COLUNAS.forEach((coluna) => {
      bruto[coluna.chave] = extrairValor(linha.getCell(cabecalho.mapa[coluna.chave]).value);
    });

    const vazia = COLUNAS.every((c) => bruto[c.chave] === '');
    if (!vazia) {
      linhas.push(bruto);
    }
  }

  if (linhas.length === 0) {
    throw new ValidationError({
      arquivo: 'A planilha não tem nenhum atleta preenchido abaixo do cabeçalho.',
    });
  }

  if (linhas.length > LIMITE_LINHAS) {
    throw new ValidationError({
      arquivo: `A planilha tem ${linhas.length} atletas. O máximo por envio é ${LIMITE_LINHAS}; divida em mais de um arquivo.`,
    });
  }

  return linhas;
}

// ---------------------------------------------------------------------------
// Validação linha a linha
// ---------------------------------------------------------------------------

function converterSexo(valor) {
  return SEXOS[normalizarTexto(valor)] || '';
}

function localizarFaixa(valor, faixasPorNome) {
  const texto = normalizarTexto(valor).replace(/^faixa\s+/, '');
  return faixasPorNome.get(texto) || null;
}

function limparNumero(valor, sufixo) {
  if (typeof valor === 'number') return valor;
  return String(valor).toLowerCase().replace(sufixo, '').trim();
}

function validarLinhas(linhas, contexto) {
  const { equipe, faixas, faixasPorNome, nomesJaInscritos } = contexto;
  const nomesNaPlanilha = new Map();
  const listaFaixas = faixas.map((f) => f.nome).join(', ');

  return linhas.map((bruto) => {
    const mensagens = [];

    const faixa = bruto.faixa === '' ? null : localizarFaixa(bruto.faixa, faixasPorNome);
    const sexo = converterSexo(bruto.sexo);

    const normalizado = normalizarInscricao({
      nome: textoExibicao(bruto.nome),
      idade: textoExibicao(limparNumero(bruto.idade, /anos?/g)),
      peso: textoExibicao(limparNumero(bruto.peso, /kg/g)),
      sexo,
      faixa_id: faixa ? String(faixa.id) : '',
      equipe_id: String(equipe.id),
    });

    const erros = validarInscricao(normalizado);

    if (erros.nome) mensagens.push(bruto.nome === '' ? 'Nome não preenchido.' : erros.nome);
    if (erros.peso) {
      mensagens.push(
        bruto.peso === ''
          ? 'Peso não preenchido.'
          : `Peso "${bruto.peso}" inválido. Use um número em kg (ex.: 76,5).`
      );
    }
    if (bruto.faixa === '') {
      mensagens.push('Faixa não preenchida.');
    } else if (!faixa) {
      mensagens.push(`Faixa "${bruto.faixa}" não existe. Use: ${listaFaixas}.`);
    }
    if (erros.idade) {
      mensagens.push(
        bruto.idade === ''
          ? 'Idade não preenchida.'
          : `Idade "${bruto.idade}" inválida. Use um número inteiro de anos.`
      );
    }
    if (erros.sexo) {
      mensagens.push(
        bruto.sexo === ''
          ? 'Sexo não preenchido (use M ou F).'
          : `Sexo "${bruto.sexo}" inválido. Use M ou F.`
      );
    }

    // Duplicidades: dentro da planilha e já inscritos neste campeonato pela mesma academia
    const chaveNome = normalizarNomePessoa(normalizado.nome);
    if (chaveNome) {
      if (nomesNaPlanilha.has(chaveNome)) {
        mensagens.push(`Atleta repetido na planilha (já aparece na linha ${nomesNaPlanilha.get(chaveNome)}).`);
      } else {
        nomesNaPlanilha.set(chaveNome, bruto.linha);
      }

      if (nomesJaInscritos.has(chaveNome)) {
        mensagens.push(`Já está inscrito neste campeonato pela academia ${equipe.nome}.`);
      }
    }

    return {
      linha: bruto.linha,
      bruto,
      dados: normalizado,
      faixa,
      mensagens,
    };
  });
}

function classificar(linha, categorias) {
  const { disponiveis, bloqueadas } = buscarCategoriasDisponiveis(
    { ...linha.dados, faixa_ordem: Number(linha.faixa.ordem) },
    categorias
  );

  if (disponiveis.length === 1) {
    return { categoria: disponiveis[0], status: 'CONFIRMADA', motivo: null, porChave: false };
  }

  let motivo = `Compatível com ${disponiveis.length} categorias`;
  if (disponiveis.length === 0) {
    motivo = bloqueadas.length > 0 ? 'Chave da categoria já começou' : 'Nenhuma categoria compatível';
  }

  return {
    categoria: null,
    status: 'PENDENTE',
    motivo,
    porChave: disponiveis.length === 0 && bloqueadas.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

async function importarPlanilha(eventoId, equipeId, buffer, usuarioId = null) {
  const evento = await validarEventoExistente(eventoId);

  const idEquipe = validarId(equipeId);
  const equipe = idEquipe ? await equipeRepository.buscarPorId(idEquipe) : null;
  if (!equipe) {
    throw new ValidationError({ equipe_id: 'Selecione a academia dos atletas.' });
  }

  if (!buffer || buffer.length === 0) {
    throw new ValidationError({ arquivo: 'Selecione a planilha .xlsx com os atletas.' });
  }

  const [linhasBrutas, faixas, categorias, nomesExistentes] = await Promise.all([
    lerPlanilha(buffer),
    faixaRepository.listarTodas(),
    categoriaRepository.listarPorEvento(evento.id),
    inscricaoRepository.listarNomesAtivosDaEquipeNoEvento(evento.id, equipe.id),
  ]);

  const faixasPorNome = new Map(faixas.map((f) => [normalizarTexto(f.nome), f]));
  const nomesJaInscritos = new Set(nomesExistentes.map((n) => normalizarNomePessoa(n)));

  const linhas = validarLinhas(linhasBrutas, {
    equipe,
    faixas,
    faixasPorNome,
    nomesJaInscritos,
  });

  const comErro = linhas.filter((l) => l.mensagens.length > 0);
  if (comErro.length > 0) {
    return {
      tipo: 'ERROS',
      evento,
      equipe,
      totalLinhas: linhas.length,
      erros: comErro.map((l) => ({
        linha: l.linha,
        nome: textoExibicao(l.bruto.nome),
        mensagens: l.mensagens,
      })),
    };
  }

  const client = await pool.connect();
  const importadas = [];
  const categoriasParaSortear = new Set();
  let pendentesPorChave = 0;

  try {
    await client.query('BEGIN');

    for (const linha of linhas) {
      const { categoria, status, motivo, porChave } = classificar(linha, categorias);
      if (porChave) pendentesPorChave++;
      if (chaveGeradaNaoIniciada(categoria)) categoriasParaSortear.add(categoria.nome);

      const inscricao = await inscricaoRepository.criar(
        {
          ...linha.dados,
          evento_id: evento.id,
          categoria_id: categoria ? categoria.id : null,
          status,
        },
        client
      );

      await auditoriaService.registrar({
        usuarioId,
        eventoId: evento.id,
        acao: 'INSCRICAO_CRIADA',
        entidade: 'INSCRICAO',
        entidadeId: inscricao.id,
        descricao: `Inscrição "${inscricao.nome}" criada por planilha (${equipe.nome}).`,
        dadosAnteriores: null,
        dadosNovos: {
          nome: inscricao.nome,
          idade: inscricao.idade,
          peso: inscricao.peso,
          sexo: inscricao.sexo,
          faixa_id: inscricao.faixa_id,
          equipe_id: inscricao.equipe_id,
          categoria_id: inscricao.categoria_id,
          status: inscricao.status,
          origem: 'PLANILHA',
        },
        client,
      });

      importadas.push({
        id: inscricao.id,
        nome: inscricao.nome,
        idade: inscricao.idade,
        peso: inscricao.peso,
        sexo: inscricao.sexo,
        faixa_nome: linha.faixa.nome,
        categoria_nome: categoria ? categoria.nome : null,
        status,
        motivo,
      });
    }

    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }

  return {
    tipo: 'IMPORTADO',
    evento,
    equipe,
    importadas,
    resumo: {
      total: importadas.length,
      confirmadas: importadas.filter((i) => i.status === 'CONFIRMADA').length,
      pendentes: importadas.filter((i) => i.status === 'PENDENTE').length,
      pendentesPorChave,
      categoriasParaSortear: Array.from(categoriasParaSortear),
    },
  };
}

module.exports = {
  COLUNAS,
  LIMITE_LINHAS,
  prepararPagina,
  gerarModelo,
  lerPlanilha,
  importarPlanilha,
  // exportados para testes
  normalizarTexto,
  extrairValor,
  converterSexo,
};
