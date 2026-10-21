document.addEventListener('DOMContentLoaded', () => {
  // Controle da barra lateral (Mobile)
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function abrirMenu() {
    sidebar?.classList.add('open');
    sidebarBackdrop?.classList.add('visible');
    sidebarToggle?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sidebar-aberta');
    document.documentElement.classList.add('sidebar-aberta');
  }

  function fecharMenu() {
    sidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('visible');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-aberta');
    document.documentElement.classList.remove('sidebar-aberta');
  }

  sidebarToggle?.addEventListener('click', () => {
    const menuAberto = sidebar?.classList.contains('open');
    if (menuAberto) {
      fecharMenu();
    } else {
      abrirMenu();
    }
  });

  sidebarBackdrop?.addEventListener('click', fecharMenu);
  sidebarBackdrop?.addEventListener('touchmove', (event) => {
    event.preventDefault();
  }, { passive: false });

  // Ao clicar em qualquer link da sidebar no celular, fecha o menu
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      fecharMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      fecharMenu();
    }
  });

  // Confirmação para ações perigosas
  // Delegado no document (fase de captura): vale também para formulários inseridos
  // depois (atualização da chave sem recarregar) e roda antes de envios via JS.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-confirm')) {
      return;
    }
    const mensagem = form.dataset.confirm || 'Tem certeza que deseja continuar?';
    if (!window.confirm(mensagem)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
});
