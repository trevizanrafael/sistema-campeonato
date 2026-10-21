/**
 * Tela da chave: modal de lançar / corrigir resultado + envio SEM recarregar a página.
 *
 * - Os botões "Lançar resultado" e "Corrigir" têm data-resultado (JSON) com os dados da luta.
 * - Formulários com [data-ajax] (o do modal e o "Anular") são enviados via fetch.
 *   O servidor responde com a própria página da chave (redirect normal); aqui só trocamos
 *   o cabeçalho, a chave e o menu lateral, mantendo a rolagem exatamente onde estava.
 * - Sem JS, sem <dialog> ou se algo der errado, cai no comportamento antigo (página inteira).
 */
(function () {
  var modal = document.getElementById('modalResultado');
  if (!modal || typeof modal.showModal !== 'function') return;

  var form = document.getElementById('formModalResultado');
  var rotulo = document.getElementById('modalResultadoRotulo');
  var titulo = document.getElementById('modalResultadoTitulo');
  var aviso = document.getElementById('modalResultadoAviso');
  var confirmar = document.getElementById('modalResultadoConfirmar');
  var opcoes = modal.querySelectorAll('.modal-resultado-opcao');

  /* ---------------- Modal ---------------- */

  function preencherOpcao(opcao, atleta, n, vencedorId) {
    var radio = opcao.querySelector('input[type="radio"]');
    var nome = opcao.querySelector('[data-nome]');
    var equipe = opcao.querySelector('[data-equipe]');
    var tag = opcao.querySelector('[data-tag]');
    var ehVencedorAtual = vencedorId !== null && String(atleta.id) === String(vencedorId);

    radio.value = atleta.id;
    radio.checked = false;
    nome.textContent = atleta.nome || '—';
    equipe.textContent = atleta.equipe || 'Sem academia';
    tag.textContent = ehVencedorAtual ? 'Vencedor atual' : 'Atleta ' + n;
    tag.classList.toggle('modal-resultado-tag--atual', ehVencedorAtual);
  }

  function textoConfirmar() {
    return form.dataset.modo === 'corrigir' ? 'Salvar correção' : 'Confirmar vitória';
  }

  function abrir(dados) {
    var corrigir = dados.modo === 'corrigir';

    form.action = dados.acao;
    form.dataset.modo = dados.modo;
    rotulo.textContent = (corrigir ? 'Corrigir resultado' : 'Lançar resultado') + ' · ' + dados.titulo;
    titulo.textContent = corrigir ? 'Quem venceu de verdade?' : 'Quem venceu?';
    aviso.hidden = !corrigir;
    confirmar.disabled = false;
    confirmar.textContent = textoConfirmar();

    preencherOpcao(opcoes[0], dados.c1, 1, dados.vencedorId);
    preencherOpcao(opcoes[1], dados.c2, 2, dados.vencedorId);

    modal.showModal();
  }

  function fechar() {
    modal.close();
  }

  document.addEventListener('click', function (evento) {
    var gatilho = evento.target.closest('[data-resultado]');
    if (!gatilho) return;

    var dados;
    try {
      dados = JSON.parse(gatilho.getAttribute('data-resultado'));
    } catch (erro) {
      return; // segue o link normal
    }

    evento.preventDefault();
    abrir(dados);
  });

  modal.querySelectorAll('[data-fechar-modal]').forEach(function (botao) {
    botao.addEventListener('click', fechar);
  });

  modal.addEventListener('click', function (evento) {
    if (evento.target === modal) fechar();
  });

  /* ---------------- Aviso flutuante (não empurra a página) ---------------- */

  function mostrarAviso(texto, tipo) {
    var aviso = document.createElement('div');
    aviso.className = 'toast toast-' + (tipo === 'erro' ? 'erro' : 'sucesso');
    aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    aviso.textContent = texto;
    document.body.appendChild(aviso);

    requestAnimationFrame(function () {
      aviso.classList.add('toast-visivel');
    });

    setTimeout(function () {
      aviso.classList.remove('toast-visivel');
      setTimeout(function () { aviso.remove(); }, 300);
    }, tipo === 'erro' ? 6000 : 3000);
  }

  /* ---------------- Atualização sem recarregar ---------------- */

  function guardarRolagem() {
    return {
      x: window.scrollX,
      y: window.scrollY,
      chave: Array.prototype.map.call(document.querySelectorAll('.bracket-scroll'), function (el) {
        return { left: el.scrollLeft, top: el.scrollTop };
      }),
    };
  }

  function restaurarRolagem(r) {
    document.querySelectorAll('.bracket-scroll').forEach(function (el, i) {
      if (r.chave[i]) {
        el.scrollLeft = r.chave[i].left;
        el.scrollTop = r.chave[i].top;
      }
    });
    window.scrollTo(r.x, r.y);
  }

  function trocar(seletor, novoDoc) {
    var atual = document.querySelector(seletor);
    var novo = novoDoc.querySelector(seletor);
    if (atual && novo) atual.replaceWith(novo);
    return Boolean(atual && novo);
  }

  function destacarLutas(ids) {
    ids.forEach(function (id) {
      var card = id && document.getElementById('match-' + id);
      if (!card) return;
      card.classList.add('match-atualizada');
      setTimeout(function () { card.classList.remove('match-atualizada'); }, 1600);
    });
  }

  function aplicarPagina(html, lutaId) {
    var novoDoc = new DOMParser().parseFromString(html, 'text/html');
    var rolagem = guardarRolagem();

    // Antes da troca: lembra para onde cada luta apontava (para destacar a próxima)
    var cardAntigo = lutaId && document.getElementById('match-' + lutaId);
    var proximaId = cardAntigo ? cardAntigo.dataset.nextMatchId : null;

    var ok = trocar('main.main-content .page-header', novoDoc)
      && trocar('main.main-content .page-content', novoDoc);
    if (!ok) return false;

    // Menu lateral (contador de lutas prontas)
    var sidebarAtual = document.getElementById('sidebar');
    var sidebarNovo = novoDoc.getElementById('sidebar');
    if (sidebarAtual && sidebarNovo) sidebarAtual.innerHTML = sidebarNovo.innerHTML;

    // Token CSRF mais recente para o formulário do modal
    var token = novoDoc.querySelector('input[name="_csrf"]');
    var tokenModal = form.querySelector('input[name="_csrf"]');
    if (token && tokenModal) tokenModal.value = token.value;

    restaurarRolagem(rolagem);
    if (typeof window.desenharConexoes === 'function') {
      window.desenharConexoes();
      requestAnimationFrame(function () {
        restaurarRolagem(rolagem);
        window.desenharConexoes();
      });
    }

    // Mensagens do servidor viram aviso flutuante
    novoDoc.querySelectorAll('main.main-content > .alert').forEach(function (alerta) {
      mostrarAviso(alerta.textContent.trim(), alerta.classList.contains('alert-danger') ? 'erro' : 'sucesso');
    });

    destacarLutas([lutaId, proximaId]);
    return true;
  }

  function lutaIdDaAcao(acao) {
    var m = /\/lutas\/(\d+)\//.exec(acao || '');
    return m ? m[1] : null;
  }

  function envioNormal(formulario) {
    HTMLFormElement.prototype.submit.call(formulario);
  }

  document.addEventListener('submit', function (evento) {
    var formulario = evento.target;
    if (!(formulario instanceof HTMLFormElement) || !formulario.hasAttribute('data-ajax')) return;
    if (evento.defaultPrevented) return; // ex.: confirmação cancelada

    evento.preventDefault();

    var botao = formulario.querySelector('[type="submit"]');
    var textoOriginal = botao ? botao.textContent : '';
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Salvando...';
    }

    var lutaId = lutaIdDaAcao(formulario.getAttribute('action'));
    var caminhoAtual = window.location.pathname;

    fetch(formulario.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(formulario)),
      credentials: 'same-origin',
    })
      .then(function (resposta) {
        var destino = new URL(resposta.url, window.location.href);
        // Se o servidor mandou para outra página (ex.: erro de validação), segue para ela
        if (destino.pathname !== caminhoAtual) {
          window.location.href = resposta.url;
          return null;
        }
        return resposta.text();
      })
      .then(function (html) {
        if (html === null) return;
        if (modal.open) fechar();
        if (!aplicarPagina(html, lutaId)) {
          window.location.reload();
        }
      })
      .catch(function () {
        // Falha de rede/JS: volta ao envio tradicional
        envioNormal(formulario);
      })
      .finally(function () {
        if (botao && document.body.contains(botao)) {
          botao.disabled = false;
          botao.textContent = formulario === form ? textoConfirmar() : textoOriginal;
        }
      });
  });
})();
