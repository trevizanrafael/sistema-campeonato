/**
 * Validador e normalizador para lançamento de resultados de lutas.
 */

function converterPlacar(valor) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const normalizado = String(valor).trim();
  if (!/^-?\d+$/.test(normalizado)) {
    return Number.NaN;
  }

  const numero = Number(normalizado);
  return Number.isInteger(numero) ? numero : Number.NaN;
}

function normalizarResultado(body = {}) {
  return {
    vencedor_id: body.vencedor_id ? Number(body.vencedor_id) : null,
    tipo_resultado:
      typeof body.tipo_resultado === 'string' && body.tipo_resultado.trim()
        ? body.tipo_resultado.trim().toUpperCase()
        : null,
    placar_1: converterPlacar(body.placar_1),
    placar_2: converterPlacar(body.placar_2),
    observacao:
      typeof body.observacao === 'string' && body.observacao.trim()
        ? body.observacao.trim()
        : null,
  };
}

function validarResultado(dados = {}, luta = {}) {
  const erros = {};

  // 1. Validar vencedor (obrigatório)
  if (!dados.vencedor_id) {
    erros.vencedor_id = 'Selecione o competidor vencedor.';
  } else {
    const vencedorValido =
      dados.vencedor_id === Number(luta.competidor_1_id) ||
      dados.vencedor_id === Number(luta.competidor_2_id);

    if (!vencedorValido) {
      erros.vencedor_id = 'Selecione um competidor válido.';
    }
  }

  // 2. Validar tipo de resultado (opcional)
  if (dados.tipo_resultado) {
    const tiposPermitidos = [
      'PONTOS',
      'FINALIZACAO',
      'DECISAO',
      'WO',
      'DESCLASSIFICACAO',
    ];

    if (!tiposPermitidos.includes(dados.tipo_resultado)) {
      erros.tipo_resultado = 'Selecione um tipo de resultado válido.';
    } else if (dados.tipo_resultado === 'PONTOS') {
      if (dados.placar_1 === null || dados.placar_2 === null) {
        erros.placar = 'Informe o placar dos dois competidores.';
      } else if (
        Number.isNaN(dados.placar_1) ||
        Number.isNaN(dados.placar_2)
      ) {
        erros.placar = 'Os placares devem ser números inteiros.';
      } else if (dados.placar_1 < 0 || dados.placar_2 < 0) {
        erros.placar = 'Os placares não podem ser negativos.';
      } else if (dados.placar_1 === dados.placar_2) {
        erros.placar = 'Uma vitória por pontos não pode terminar empatada.';
      } else {
        if (
          dados.vencedor_id === Number(luta.competidor_1_id) &&
          dados.placar_1 <= dados.placar_2
        ) {
          erros.vencedor_id = 'O vencedor selecionado não possui o maior placar.';
        }
        if (
          dados.vencedor_id === Number(luta.competidor_2_id) &&
          dados.placar_2 <= dados.placar_1
        ) {
          erros.vencedor_id = 'O vencedor selecionado não possui o maior placar.';
        }
      }
    } else if (dados.tipo_resultado === 'DECISAO') {
      const umInformado =
        (dados.placar_1 !== null && dados.placar_2 === null) ||
        (dados.placar_1 === null && dados.placar_2 !== null);

      if (umInformado) {
        erros.placar = 'Informe os dois placares ou deixe ambos vazios.';
      } else if (dados.placar_1 !== null && dados.placar_2 !== null) {
        if (
          Number.isNaN(dados.placar_1) ||
          Number.isNaN(dados.placar_2) ||
          dados.placar_1 < 0 ||
          dados.placar_2 < 0
        ) {
          erros.placar = 'Os placares devem ser números inteiros não negativos.';
        }
      }
    } else if (
      ['FINALIZACAO', 'WO', 'DESCLASSIFICACAO'].includes(dados.tipo_resultado)
    ) {
      // Placares não se aplicam e são limpos
      dados.placar_1 = null;
      dados.placar_2 = null;
    }
  }

  // 3. Observação (opcional)
  if (dados.observacao && dados.observacao.length > 1000) {
    erros.observacao = 'A observação deve ter no máximo 1.000 caracteres.';
  }

  return erros;
}

module.exports = {
  converterPlacar,
  normalizarResultado,
  validarResultado,
};
