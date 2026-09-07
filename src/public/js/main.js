document.addEventListener('DOMContentLoaded', () => {
  // Controle da barra lateral (Mobile)
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function abrirMenu() {
    sidebar?.classList.add('open');
    sidebarBackdrop?.classList.add('visible');
    sidebarToggle?.setAttribute('aria-expanded', 'true');
  }

  function fecharMenu() {
    sidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('visible');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      fecharMenu();
    }
  });

  // Confirmação para ações perigosas
  const formsComConfirmacao = document.querySelectorAll('form[data-confirm]');
  formsComConfirmacao.forEach((form) => {
    form.addEventListener('submit', (event) => {
      const mensagem = form.dataset.confirm || 'Tem certeza que deseja continuar?';
      if (!window.confirm(mensagem)) {
        event.preventDefault();
      }
    });
  });
});
