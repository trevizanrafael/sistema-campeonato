const pool = require('../src/config/database');
const {
  inscricaoCompativelComCategoria,
  categoriasSeSobrepoem,
} = require('../src/services/classificacaoService');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 8 (Categorias e Classificação) ---');
  let testCount = 0;
  let passedCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // ==========================================
  // 1. TESTES UNITÁRIOS DO MOTOR DE CLASSIFICAÇÃO
  // ==========================================
  console.log('\n--- 1. Testes de Intervalo de Idade ---');
  const catJuvenil = {
    idade_minima: 16,
    idade_maxima: 17,
    peso_minimo: null,
    peso_maximo: null,
    faixa_minima_ordem: null,
    faixa_maxima_ordem: null,
    sexo: 'MISTO',
  };

  assert(
    inscricaoCompativelComCategoria({ idade: 16, peso: 60, faixa_ordem: 2, sexo: 'MASCULINO' }, catJuvenil),
    'Categoria 16-17 aceita 16 anos'
  );
  assert(
    inscricaoCompativelComCategoria({ idade: 17, peso: 60, faixa_ordem: 2, sexo: 'MASCULINO' }, catJuvenil),
    'Categoria 16-17 aceita 17 anos'
  );
  assert(
    !inscricaoCompativelComCategoria({ idade: 15, peso: 60, faixa_ordem: 2, sexo: 'MASCULINO' }, catJuvenil),
    'Categoria 16-17 nao aceita 15 anos'
  );
  assert(
    !inscricaoCompativelComCategoria({ idade: 18, peso: 60, faixa_ordem: 2, sexo: 'MASCULINO' }, catJuvenil),
    'Categoria 16-17 nao aceita 18 anos'
  );

  const catSemMinIdade = { idade_minima: null, idade_maxima: 15, peso_minimo: null, peso_maximo: null, sexo: 'MISTO' };
  assert(
    inscricaoCompativelComCategoria({ idade: 10, peso: 40, faixa_ordem: 1, sexo: 'FEMININO' }, catSemMinIdade),
    'Aceita minimo de idade vazio (ate 15)'
  );

  const catSemMaxIdade = { idade_minima: 18, idade_maxima: null, peso_minimo: null, peso_maximo: null, sexo: 'MISTO' };
  assert(
    inscricaoCompativelComCategoria({ idade: 35, peso: 80, faixa_ordem: 3, sexo: 'MASCULINO' }, catSemMaxIdade),
    'Aceita maximo de idade vazio (a partir de 18)'
  );

  console.log('\n--- 2. Testes de Intervalo de Peso ---');
  // Categoria A: ate 60 kg (min null, max 60)
  const catAte60 = {
    idade_minima: null,
    idade_maxima: null,
    peso_minimo: null,
    peso_maximo: 60.0,
    sexo: 'MISTO',
  };
  // Categoria B: acima de 60 ate 70 kg (min 60, max 70)
  const cat60a70 = {
    idade_minima: null,
    idade_maxima: null,
    peso_minimo: 60.0,
    peso_maximo: 70.0,
    sexo: 'MISTO',
  };

  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 60.0, faixa_ordem: 1, sexo: 'MASCULINO' }, catAte60),
    'Categoria ate 60 aceita atleta com 60,00 kg'
  );
  assert(
    !inscricaoCompativelComCategoria({ idade: 20, peso: 60.0, faixa_ordem: 1, sexo: 'MASCULINO' }, cat60a70),
    'Categoria acima de 60 NAO aceita atleta com 60,00 kg (minimo exclusivo)'
  );
  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 60.01, faixa_ordem: 1, sexo: 'MASCULINO' }, cat60a70),
    'Categoria acima de 60 aceita atleta com 60,01 kg'
  );
  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 70.0, faixa_ordem: 1, sexo: 'MASCULINO' }, cat60a70),
    'Categoria ate 70 aceita atleta com 70,00 kg'
  );

  console.log('\n--- 3. Testes de Ordem das Faixas ---');
  // Ordem das faixas padrão: 1: Branca, 2: Azul, 3: Roxa, 4: Marrom, 5: Preta
  const catAzulAteMarrom = {
    faixa_minima_ordem: 2,
    faixa_maxima_ordem: 4,
    sexo: 'MISTO',
  };

  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 70, faixa_ordem: 2, sexo: 'MASCULINO' }, catAzulAteMarrom),
    'Azul ate Marrom aceita Azul (ordem 2)'
  );
  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 70, faixa_ordem: 3, sexo: 'MASCULINO' }, catAzulAteMarrom),
    'Azul ate Marrom aceita Roxa (ordem 3)'
  );
  assert(
    inscricaoCompativelComCategoria({ idade: 20, peso: 70, faixa_ordem: 4, sexo: 'MASCULINO' }, catAzulAteMarrom),
    'Azul ate Marrom aceita Marrom (ordem 4)'
  );
  assert(
    !inscricaoCompativelComCategoria({ idade: 20, peso: 70, faixa_ordem: 1, sexo: 'MASCULINO' }, catAzulAteMarrom),
    'Azul ate Marrom NAO aceita Branca (ordem 1)'
  );
  assert(
    !inscricaoCompativelComCategoria({ idade: 20, peso: 70, faixa_ordem: 5, sexo: 'MASCULINO' }, catAzulAteMarrom),
    'Azul ate Marrom NAO aceita Preta (ordem 5)'
  );

  console.log('\n--- 4. Testes de Sexo ---');
  const catMasc = { sexo: 'MASCULINO' };
  const catFem = { sexo: 'FEMININO' };
  const catMisto = { sexo: 'MISTO' };

  assert(
    inscricaoCompativelComCategoria({ sexo: 'MASCULINO' }, catMasc),
    'Categoria Masculino aceita inscricao masculina'
  );
  assert(
    !inscricaoCompativelComCategoria({ sexo: 'FEMININO' }, catMasc),
    'Categoria Masculino rejeita inscricao feminina'
  );
  assert(
    inscricaoCompativelComCategoria({ sexo: 'FEMININO' }, catFem),
    'Categoria Feminino aceita inscricao feminina'
  );
  assert(
    !inscricaoCompativelComCategoria({ sexo: 'MASCULINO' }, catFem),
    'Categoria Feminino rejeita inscricao masculina'
  );
  assert(
    inscricaoCompativelComCategoria({ sexo: 'MASCULINO' }, catMisto) &&
      inscricaoCompativelComCategoria({ sexo: 'FEMININO' }, catMisto),
    'Categoria Misto aceita ambos os sexos'
  );

  console.log('\n--- 5. Testes de Sobreposicao / Conflitos ---');
  // Fronteira de peso: ate 60 e acima de 60
  assert(
    !categoriasSeSobrepoem(
      { peso_minimo: null, peso_maximo: 60, sexo: 'MASCULINO' },
      { peso_minimo: 60, peso_maximo: 70, sexo: 'MASCULINO' }
    ),
    'Nao considera 60 kg conflito entre ate 60 e acima de 60'
  );

  // Duas categorias realmente sobrepostas (ex: ate 65 e ate 70)
  assert(
    categoriasSeSobrepoem(
      { peso_minimo: null, peso_maximo: 65, sexo: 'MASCULINO' },
      { peso_minimo: null, peso_maximo: 70, sexo: 'MASCULINO' }
    ),
    'Detecta sobreposicao real entre ate 65 e ate 70 kg'
  );

  // Sexo divergente: Masculino e Feminino nunca se sobrepõem
  assert(
    !categoriasSeSobrepoem(
      { peso_minimo: null, peso_maximo: 70, sexo: 'MASCULINO' },
      { peso_minimo: null, peso_maximo: 70, sexo: 'FEMININO' }
    ),
    'Masculino e Feminino NAO entram em conflito'
  );

  // Categoria Misto é compatível com Masculino
  assert(
    categoriasSeSobrepoem(
      { peso_minimo: null, peso_maximo: 70, sexo: 'MISTO' },
      { peso_minimo: null, peso_maximo: 70, sexo: 'MASCULINO' }
    ),
    'Categoria Mista entra em conflito com Masculina se os outros criterios coincidirem'
  );

  // ==========================================
  // 2. TESTES DE INTEGRAÇÃO VIA HTTP E BANCO
  // ==========================================
  console.log('\n--- 6. Autenticação e Configuração de Evento para Testes ---');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campeonato.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'rafael06';

  const loginRes = await fetch('http://localhost:3000/login');
  const setCookie = loginRes.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : '';
  const loginHtml = await loginRes.text();
  const csrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const authRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: new URLSearchParams({
      email: adminEmail,
      senha: adminPass,
      _csrf: csrf,
    }).toString(),
    redirect: 'manual',
  });

  const authCookie = authRes.headers.get('set-cookie');
  const sessionCookie = authCookie ? authCookie.split(';')[0] : cookie;
  assert(authRes.status === 302, 'Admin autenticado com sucesso');

  // Criar 2 eventos para testar segurança e isolamento
  const ev1Res = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Alpha F8') RETURNING id");
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Beta F8') RETURNING id");
  const ev2Id = ev2Res.rows[0].id;

  // Helper para obter CSRF logado
  async function getCsrf(url = `http://localhost:3000/eventos/${ev1Id}/categorias`) {
    const r = await fetch(url, { headers: { Cookie: sessionCookie } });
    const h = await r.text();
    const m = h.match(/name="_csrf"\s+value="([^"]+)"/);
    return m ? m[1] : '';
  }

  const currentCsrf = await getCsrf();
  assert(!!currentCsrf, 'Token CSRF obtido com sucesso para eventos');

  // Obter faixas do banco
  const faixasRows = (await pool.query('SELECT id, nome, ordem FROM faixas ORDER BY ordem')).rows;
  const faixaAzul = faixasRows.find((f) => f.nome.toLowerCase().includes('azul')) || faixasRows[1];
  const faixaMarrom = faixasRows.find((f) => f.nome.toLowerCase().includes('marrom')) || faixasRows[3];

  console.log('\n--- 7. Cadastro de Categorias e Validações de Formulário ---');

  // 1. Cadastrar categoria válida (Juvenil Azul até 60 kg)
  const cad1Res = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Juvenil Azul ate 60 kg',
      sexo: 'MASCULINO',
      idade_minima: '16',
      idade_maxima: '17',
      peso_minimo: '',
      peso_maximo: '60',
      faixa_minima_id: String(faixaAzul.id),
      faixa_maxima_id: String(faixaAzul.id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });

  assert(cad1Res.status === 302, 'Cadastro de categoria redireciona (302)');
  assert(
    cad1Res.headers.get('location') === `/eventos/${ev1Id}/categorias`,
    'Redireciona para /eventos/:id/categorias'
  );

  const catDb1 = await pool.query(
    "SELECT * FROM categorias WHERE evento_id = $1 AND nome = 'Juvenil Azul ate 60 kg'",
    [ev1Id]
  );
  assert(catDb1.rows.length === 1, 'Categoria salva no banco de dados');
  const cat1Id = catDb1.rows[0].id;

  // 2. Validação: Bloqueia idade minima > idade maxima
  const erroIdadeRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Idade Invalida',
      sexo: 'MASCULINO',
      idade_minima: '18',
      idade_maxima: '16',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroIdadeRes.status === 422, 'Bloqueia idade minima maior que maxima (422)');

  // 3. Validação: Bloqueia idade negativa e decimal
  const erroIdadeNegRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Idade Negativa',
      sexo: 'MASCULINO',
      idade_minima: '-5',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroIdadeNegRes.status === 422, 'Bloqueia idade negativa (422)');

  const erroIdadeDecRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Idade Decimal',
      sexo: 'MASCULINO',
      idade_minima: '16.5',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroIdadeDecRes.status === 422, 'Bloqueia idade decimal (422)');

  // 4. Validação de Peso: Bloqueia minimo igual ao maximo (peso_minimo == peso_maximo)
  const erroPesoIgualRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Peso Igual',
      sexo: 'MASCULINO',
      peso_minimo: '60',
      peso_maximo: '60',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroPesoIgualRes.status === 422, 'Bloqueia peso minimo igual ao maximo (422)');

  // 5. Validação de Peso: Bloqueia minimo maior que maximo
  const erroPesoMaiorRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Peso Maior',
      sexo: 'MASCULINO',
      peso_minimo: '70',
      peso_maximo: '60',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroPesoMaiorRes.status === 422, 'Bloqueia peso minimo maior que maximo (422)');

  // 6. Aceita virgula decimal e grava corretamente
  const cadVirgulaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Adulto Medio ate 82,3 kg',
      sexo: 'MASCULINO',
      peso_minimo: '76,0',
      peso_maximo: '82,3',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(cadVirgulaRes.status === 302, 'Aceita virgula decimal no peso e redireciona (302)');
  const catVirgulaDb = await pool.query(
    "SELECT * FROM categorias WHERE evento_id = $1 AND nome = 'Adulto Medio ate 82,3 kg'",
    [ev1Id]
  );
  assert(
    Number(catVirgulaDb.rows[0].peso_maximo) === 82.3,
    'Peso normalizado de virgula para float no banco (82.3)'
  );

  // 7. Validação de Faixas: Bloqueia faixa maxima anterior a faixa minima (ex: Marrom ate Azul)
  const erroFaixaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Faixa Invertida',
      sexo: 'MASCULINO',
      faixa_minima_id: String(faixaMarrom.id),
      faixa_maxima_id: String(faixaAzul.id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroFaixaRes.status === 422, 'Bloqueia faixa maxima anterior a minima (422)');

  // 8. Validação de Sexo: Bloqueia sexo invalido
  const erroSexoRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Sexo Invalido',
      sexo: 'OUTRO_VALOR',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroSexoRes.status === 422, 'Bloqueia sexo invalido (422)');

  // 9. Nome repetido dentro do mesmo evento
  const erroNomeRepetidoRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: '  JUVENIL AZUL ATE 60 KG  ',
      sexo: 'MASCULINO',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroNomeRepetidoRes.status === 422, 'Bloqueia nome repetido no mesmo evento case-insensitive (422)');

  // 10. Mesmo nome em evento DIFERENTE é permitido
  const cadEv2Res = await fetch(`http://localhost:3000/eventos/${ev2Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Juvenil Azul ate 60 kg',
      sexo: 'MASCULINO',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(cadEv2Res.status === 302, 'Permite mesmo nome de categoria em eventos diferentes');

  console.log('\n--- 8. Conflito e Detecção de Sobreposição ---');
  // Cadastrar categoria que se sobrepõe com a primeira no Evento 1
  const cadSobrepostaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Juvenil Azul ate 65 kg',
      sexo: 'MASCULINO',
      idade_minima: '16',
      idade_maxima: '18',
      peso_minimo: '',
      peso_maximo: '65',
      faixa_minima_id: String(faixaAzul.id),
      faixa_maxima_id: String(faixaAzul.id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(cadSobrepostaRes.status === 302, 'Salva categoria sobreposta sem bloquear (302)');

  // Verificar mensagem de sobreposição na listagem
  const listRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias`, {
    headers: { Cookie: sessionCookie },
  });
  const listHtml = await listRes.text();
  assert(listHtml.includes('Sobreposicao'), 'Aviso de sobreposicao exibido na listagem');

  console.log('\n--- 9. Segurança e Isolamento Entre Eventos (404) ---');
  // Tentar acessar categoria do Evento 1 pelo Evento 2
  const fakeAccessRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/categorias/${cat1Id}/editar`, {
    headers: { Cookie: sessionCookie },
  });
  assert(fakeAccessRes.status === 404, 'Acesso a categoria com evento incorreto retorna 404');

  const fakeEditRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/categorias/${cat1Id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Invasao de Evento',
      sexo: 'MASCULINO',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(fakeEditRes.status === 404, 'Tentativa de edicao em evento incorreto retorna 404');

  const fakeDeleteRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/categorias/${cat1Id}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(fakeDeleteRes.status === 404, 'Tentativa de exclusao em evento incorreto retorna 404');

  console.log('\n--- 10. Edição com Inscrições e Proteção de Critérios ---');
  // Criar uma equipe para vincular inscritos
  const eqRes = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste Cat') RETURNING id");
  const eqId = eqRes.rows[0].id;

  // Inserir um atleta de 59 kg na categoria Juvenil Azul até 60 kg (cat1Id)
  const atletaRes = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo)
     VALUES ($1, $2, $3, $4, 'Atleta Teste Peso', 16, 59.00, 'MASCULINO') RETURNING id`,
    [ev1Id, cat1Id, eqId, faixaAzul.id]
  );
  const atletaId = atletaRes.rows[0].id;

  // Tentar alterar peso máximo da categoria para 55 kg (tornaria o atleta de 59 kg incompatível)
  const editBloqueadaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias/${cat1Id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Juvenil Azul ate 55 kg',
      sexo: 'MASCULINO',
      idade_minima: '16',
      idade_maxima: '17',
      peso_minimo: '',
      peso_maximo: '55',
      faixa_minima_id: String(faixaAzul.id),
      faixa_maxima_id: String(faixaAzul.id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editBloqueadaRes.status === 422, 'Bloqueia alteracao que deixaria inscricao incompativel (422)');
  const editBloqueadaHtml = await editBloqueadaRes.text();
  assert(
    editBloqueadaHtml.includes('Atleta Teste Peso'),
    'Mensagem de erro cita o nome do atleta incompativel'
  );

  // Alterar critério mantendo inscrições compatíveis (ex: aumentar peso para 62 kg)
  const editPermitidaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias/${cat1Id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Juvenil Azul ate 62 kg',
      sexo: 'MASCULINO',
      idade_minima: '16',
      idade_maxima: '17',
      peso_minimo: '',
      peso_maximo: '62',
      faixa_minima_id: String(faixaAzul.id),
      faixa_maxima_id: String(faixaAzul.id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(editPermitidaRes.status === 302, 'Permite alteracao compativel com inscricoes existentes (302)');

  console.log('\n--- 11. Proteção Quando Existe Chave ---');
  // Criar uma chave para a categoria
  const chaveRes = await pool.query(
    `INSERT INTO chaves (categoria_id, nome, tamanho, status)
     VALUES ($1, 'Chave Juvenil Azul', 4, 'NAO_INICIADA') RETURNING id`,
    [cat1Id]
  );
  const chaveId = chaveRes.rows[0].id;

  // Tentar editar critérios com chave existente (deve ignorar novos critérios e alterar SOMENTE o nome)
  const editComChaveRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias/${cat1Id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Nome Atualizado Com Chave',
      sexo: 'FEMININO', // tentativa maliciosa de mudar sexo
      peso_maximo: '99', // tentativa maliciosa de mudar peso
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(editComChaveRes.status === 302, 'Edicao com chave permitida para nome (302)');

  const catVerifChave = await pool.query('SELECT * FROM categorias WHERE id = $1', [cat1Id]);
  assert(
    catVerifChave.rows[0].nome === 'Nome Atualizado Com Chave',
    'Nome foi atualizado com sucesso'
  );
  assert(
    catVerifChave.rows[0].sexo === 'MASCULINO',
    'Sexo original foi preservado (criterios bloqueados por presenca de chave)'
  );
  assert(
    Number(catVerifChave.rows[0].peso_maximo) === 62,
    'Peso maximo original foi preservado (62 kg mantido)'
  );

  console.log('\n--- 12. Regras de Exclusão ---');
  // 1. Tentar excluir categoria que possui chave e inscrição (deve ser bloqueado)
  const delBloqRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias/${cat1Id}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(delBloqRes.status === 302, 'Tentativa de excluir categoria em uso redireciona (302)');

  const catAindaExiste = await pool.query('SELECT id FROM categorias WHERE id = $1', [cat1Id]);
  assert(catAindaExiste.rows.length === 1, 'Categoria com chave/inscricao NAO foi excluida');

  // 2. Excluir categoria vazia (sem inscrições e sem chaves)
  const catVaziaRes = await pool.query(
    "INSERT INTO categorias (evento_id, nome, sexo) VALUES ($1, 'Categoria Vazia Para Excluir', 'MASCULINO') RETURNING id",
    [ev1Id]
  );
  const catVaziaId = catVaziaRes.rows[0].id;

  const delVaziaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/categorias/${catVaziaId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(delVaziaRes.status === 302, 'Excluir categoria vazia redireciona com sucesso');

  const catVaziaDb = await pool.query('SELECT id FROM categorias WHERE id = $1', [catVaziaId]);
  assert(catVaziaDb.rows.length === 0, 'Categoria vazia foi excluida do banco');

  // Limpeza dos dados criados durante os testes
  await pool.query('DELETE FROM chaves WHERE id = $1', [chaveId]);
  await pool.query('DELETE FROM inscricoes WHERE id = $1', [atletaId]);
  await pool.query('DELETE FROM equipes WHERE id = $1', [eqId]);
  await pool.query('DELETE FROM categorias WHERE evento_id IN ($1, $2)', [ev1Id, ev2Id]);
  await pool.query('DELETE FROM regras_pontuacao WHERE evento_id IN ($1, $2)', [ev1Id, ev2Id]);
  await pool.query('DELETE FROM eventos WHERE id IN ($1, $2)', [ev1Id, ev2Id]);

  console.log(`\n--- RESULTADO FASE 8: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
