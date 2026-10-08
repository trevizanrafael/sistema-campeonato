// Motor compartilhado para gravação de vídeos passo a passo com Playwright.
require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.DEMO_URL || `http://localhost:${process.env.PORT || 3000}`;
const EMAIL = process.env.ADMIN_EMAIL;
const SENHA = process.env.ADMIN_PASSWORD;
const PASTA_VIDEOS = path.join(__dirname, 'videos');
const LARGURA = 1366;
const ALTURA = 768;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = () => {
  const montar = () => {
    if (document.getElementById('demo-cursor')) return;
    const estilo = document.createElement('style');
    estilo.textContent = `
      #demo-cursor { position: fixed; z-index: 2147483647; pointer-events: none; width: 26px; height: 26px;
        transform: translate(-4px, -2px); transition: transform .08s; filter: drop-shadow(0 2px 4px rgba(0,0,0,.55)); }
      #demo-cursor.clicando { transform: translate(-4px, -2px) scale(.82); }
      .demo-clique { position: fixed; z-index: 2147483646; pointer-events: none; width: 48px; height: 48px; margin: -24px 0 0 -24px;
        border-radius: 50%; border: 3px solid #ffcc00; animation: demo-onda .6s ease-out forwards; }
      @keyframes demo-onda { from { transform: scale(.25); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
      #demo-legenda { position: fixed; z-index: 2147483645; left: 50%; bottom: 28px; transform: translateX(-50%);
        max-width: 82%; padding: 14px 26px; border-radius: 12px; background: rgba(15,15,20,.92); color: #fff;
        font: 600 20px/1.35 system-ui, "Segoe UI", sans-serif; text-align: center; box-shadow: 0 10px 35px rgba(0,0,0,.45);
        pointer-events: none; transition: opacity .25s; border: 1px solid rgba(255,255,255,.12); }
      #demo-legenda:empty { opacity: 0; }
      #demo-legenda small { display: block; margin-top: 4px; font-weight: 400; font-size: 15px; opacity: .85; color: #e5e7eb; }`;
    document.head.appendChild(estilo);

    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 10.5-7 1.3 4.2 7.4-3 1.6-4.1-7.4L4 20z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const pos = JSON.parse(sessionStorage.getItem('demo-pos') || '[683,384]');
    cursor.style.left = pos[0] + 'px';
    cursor.style.top = pos[1] + 'px';
    document.body.appendChild(cursor);

    const legenda = document.createElement('div');
    legenda.id = 'demo-legenda';
    legenda.innerHTML = sessionStorage.getItem('demo-legenda') || '';
    document.body.appendChild(legenda);

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      sessionStorage.setItem('demo-pos', JSON.stringify([e.clientX, e.clientY]));
    }, true);
    document.addEventListener('mousedown', (e) => {
      cursor.classList.add('clicando');
      const onda = document.createElement('div');
      onda.className = 'demo-clique';
      onda.style.left = e.clientX + 'px';
      onda.style.top = e.clientY + 'px';
      document.body.appendChild(onda);
      setTimeout(() => onda.remove(), 600);
    }, true);
    document.addEventListener('mouseup', () => cursor.classList.remove('clicando'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
};

async function criarSessao(nomeVideo, { headless = true } = {}) {
  fs.mkdirSync(PASTA_VIDEOS, { recursive: true });

  let browser;
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try {
      browser = await chromium.launch({ headless, channel });
      break;
    } catch {
      // tenta o próximo canal
    }
  }
  if (!browser) throw new Error('Nenhum navegador pôde ser aberto.');

  const context = await browser.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    recordVideo: { dir: PASTA_VIDEOS, size: { width: LARGURA, height: ALTURA } },
    locale: 'pt-BR',
  });
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('dialog', (dialog) => dialog.accept());

  const helpers = {
    BASE,
    EMAIL,
    SENHA,
    page,
    esperar,
    legenda: async (titulo, detalhe = '') => {
      const html = detalhe ? `${titulo}<small>${detalhe}</small>` : titulo;
      await page.evaluate((h) => {
        sessionStorage.setItem('demo-legenda', h);
        const el = document.getElementById('demo-legenda');
        if (el) el.innerHTML = h;
      }, html);
      await esperar(800);
    },
    limparLegenda: async () => {
      await page.evaluate(() => {
        sessionStorage.removeItem('demo-legenda');
        const el = document.getElementById('demo-legenda');
        if (el) el.innerHTML = '';
      });
      await esperar(400);
    },
    rolarAte: async (seletor) => {
      await page.locator(seletor).first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await esperar(1000);
    },
    moverPara: async (alvo) => {
      const loc = typeof alvo === 'string' ? page.locator(alvo).first() : alvo;
      await loc.scrollIntoViewIfNeeded();
      const box = await loc.boundingBox();
      if (!box) return loc;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
      await esperar(450);
      return loc;
    },
    clicar: async (alvo, { navega = false } = {}) => {
      const loc = await helpers.moverPara(alvo);
      if (navega) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}),
          loc.click(),
        ]);
      } else {
        await loc.click();
      }
      await esperar(600);
    },
    digitar: async (seletor, texto, delay = 85) => {
      await helpers.clicar(seletor);
      await page.locator(seletor).first().pressSequentially(String(texto), { delay });
      await esperar(350);
    },
    escolher: async (seletor, opcao) => {
      await helpers.moverPara(seletor);
      await page.locator(seletor).first().selectOption(opcao);
      await esperar(550);
    },
    irPara: async (url) => {
      for (let i = 1; i <= 4; i += 1) {
        try {
          await page.goto(url, { waitUntil: 'load' });
          return;
        } catch (err) {
          if (i === 4) throw err;
          await esperar(1500);
        }
      }
    },
    login: async () => {
      await helpers.irPara(`${BASE}/login`);
      await helpers.digitar('input[name=email]', EMAIL);
      await helpers.digitar('input[name=senha]', SENHA);
      await helpers.clicar('form[action="/login"] button[type=submit]', { navega: true });
      await esperar(1000);
    },
    finalizar: async () => {
      await helpers.limparLegenda();
      await esperar(1000);
      const video = page.video();
      await context.close();
      const destino = path.join(PASTA_VIDEOS, `${nomeVideo}.webm`);
      if (video) {
        try {
          await video.saveAs(destino);
          try { await video.delete(); } catch {}
          console.log(`✓ Vídeo gravado com sucesso: ${destino}`);
        } catch (err) {
          console.log('Aviso ao salvar vídeo:', err.message);
        }
      }
      await browser.close();
    },
  };

  return helpers;
}

module.exports = { criarSessao, esperar, BASE, EMAIL, SENHA, PASTA_VIDEOS };
