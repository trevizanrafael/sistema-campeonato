/**
 * Inscrição por documento: busca de academia, arrastar-e-soltar da planilha
 * e habilitação do botão de envio.
 */
(function () {
  const form = document.getElementById('formInscricaoDocumento');
  if (!form) return;

  const inputArquivo = document.getElementById('arquivoPlanilha');
  const dropzone = document.getElementById('dropzonePlanilha');
  const titulo = dropzone ? dropzone.querySelector('.doc-dropzone__titulo') : null;
  const botao = document.getElementById('botaoImportar');
  const busca = document.getElementById('buscaAcademia');
  const nadaEncontrado = document.getElementById('academiaNaoEncontrada');
  const academias = Array.from(form.querySelectorAll('.doc-equipe'));

  const academiaSelecionada = () => form.querySelector('input[name="equipe_id"]:checked');
  const arquivoValido = (arquivo) => arquivo && /\.xlsx$/i.test(arquivo.name);

  function formatarTamanho(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }

  function atualizarEstado() {
    const arquivo = inputArquivo && inputArquivo.files[0];
    const ok = arquivoValido(arquivo);

    if (dropzone && titulo) {
      dropzone.classList.toggle('is-preenchida', Boolean(ok));
      titulo.textContent = ok
        ? arquivo.name + ' (' + formatarTamanho(arquivo.size) + ')'
        : titulo.dataset.padrao;
    }

    if (botao) {
      botao.disabled = !(ok && academiaSelecionada());
      const faltando = !academiaSelecionada()
        ? 'Escolha a academia'
        : !ok
          ? 'Escolha a planilha .xlsx'
          : '';
      botao.title = faltando;
    }
  }

  // Busca de academias
  if (busca) {
    busca.addEventListener('input', function () {
      const termo = busca.value.trim().toLowerCase();
      let visiveis = 0;

      academias.forEach(function (item) {
        const mostrar = !termo || item.dataset.nome.indexOf(termo) !== -1;
        item.hidden = !mostrar;
        if (mostrar) visiveis++;
      });

      if (nadaEncontrado) nadaEncontrado.hidden = visiveis > 0;
    });
  }

  form.addEventListener('change', function (evento) {
    if (evento.target === inputArquivo) {
      const arquivo = inputArquivo.files[0];
      if (arquivo && !arquivoValido(arquivo)) {
        alert('Envie um arquivo .xlsx (Excel). Baixe a planilha modelo se tiver dúvida.');
        inputArquivo.value = '';
      }
    }
    atualizarEstado();
  });

  // Arrastar e soltar
  if (dropzone && inputArquivo) {
    ['dragenter', 'dragover'].forEach(function (tipo) {
      dropzone.addEventListener(tipo, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-arrastando');
      });
    });

    ['dragleave', 'dragend', 'drop'].forEach(function (tipo) {
      dropzone.addEventListener(tipo, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-arrastando');
      });
    });

    dropzone.addEventListener('drop', function (e) {
      const arquivo = e.dataTransfer && e.dataTransfer.files[0];
      if (!arquivo) return;

      if (!arquivoValido(arquivo)) {
        alert('Envie um arquivo .xlsx (Excel). Baixe a planilha modelo se tiver dúvida.');
        return;
      }

      const transferencia = new DataTransfer();
      transferencia.items.add(arquivo);
      inputArquivo.files = transferencia.files;
      atualizarEstado();
    });
  }

  // Evita envio duplo
  form.addEventListener('submit', function (e) {
    if (botao && botao.disabled) {
      e.preventDefault();
      return;
    }
    if (botao) {
      botao.classList.add('is-enviando');
      const rotulo = botao.querySelector('span');
      if (rotulo) rotulo.textContent = 'Importando...';
    }
  });

  // Rola até a academia já selecionada (ex.: após erro)
  const marcada = academiaSelecionada();
  if (marcada) {
    marcada.closest('.doc-equipe').scrollIntoView({ block: 'nearest' });
  }

  atualizarEstado();
})();
