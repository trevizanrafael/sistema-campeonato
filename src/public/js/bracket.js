/**
 * Desenho de conectores ortogonais em SVG entre as lutas do chaveamento.
 */

function desenharConexoes() {
  const bracket = document.getElementById('bracket');
  const svg = document.getElementById('bracketConnections');

  if (!bracket || !svg) {
    return;
  }

  svg.innerHTML = '';

  const bracketRect = bracket.getBoundingClientRect();
  const scrollWidth = bracket.scrollWidth;
  const scrollHeight = bracket.scrollHeight;

  svg.setAttribute('viewBox', `0 0 ${scrollWidth} ${scrollHeight}`);
  svg.setAttribute('width', scrollWidth);
  svg.setAttribute('height', scrollHeight);

  const lutas = bracket.querySelectorAll('[data-next-match-id]');

  lutas.forEach((luta) => {
    const proximaId = luta.dataset.nextMatchId;
    if (!proximaId) {
      return;
    }

    const proxima = document.getElementById(`match-${proximaId}`);
    if (!proxima) {
      return;
    }

    const origemRect = luta.getBoundingClientRect();
    const destinoRect = proxima.getBoundingClientRect();

    const x1 = origemRect.right - bracketRect.left;
    const y1 = origemRect.top - bracketRect.top + origemRect.height / 2;

    const x2 = destinoRect.left - bracketRect.left;
    const y2 = destinoRect.top - bracketRect.top + destinoRect.height / 2;

    const meioX = (x1 + x2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      `M ${x1} ${y1} H ${meioX} V ${y2} H ${x2}`
    );
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#666666');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');

    svg.appendChild(path);
  });
}

// Ouvintes de eventos com debounce para otimização
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(desenharConexoes, 100);
});

window.addEventListener('load', desenharConexoes);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(desenharConexoes, 50);
} else {
  document.addEventListener('DOMContentLoaded', desenharConexoes);
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(desenharConexoes);
}
