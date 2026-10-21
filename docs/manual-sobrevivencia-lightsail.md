# 🥋 Manual de Sobrevivência na Nuvem: AWS Lightsail, Dimensionamento e as Armadilhas do Público Aberto

> **Documento de Arquitetura & Infraestrutura**  
> **Status:** Ativo / Recomendado  
> **Público-alvo:** Desenvolvedores, mantenedores e operadores de infraestrutura do sistema.

---

## 1. Visão Geral e Contexto

Este documento consolida as diretrizes de hospedagem, capacidade operacional e sobrevivência técnica para levar o **Sistema de Gestão de Campeonatos de Jiu-Jitsu** para a nuvem utilizando a **AWS Lightsail**.

O sistema foi arquitetado como um monólito enxuto e eficiente baseado em:
* **Node.js LTS (v18+)** com **Express 5**
* Renderização no lado do servidor (**SSR**) com **EJS**
* Banco de dados relacional **PostgreSQL 14+** com modelo de extrato contábil (*Append-Only Ledger*, conforme [ADR-01](adr/ADR-CAMP-01-Rafael-ledger-pontuacao.md))
* Sorteio de chaves eliminatórias em memória com Fisher-Yates criptográfico ([ADR-02](adr/ADR-CAMP-02-Nicolly-sorteio-chaves.md))

Por não utilizar builds pesados no frontend em tempo de execução nem microsserviços dispersos, o consumo básico de recursos é extremamente baixo. Contudo, ao **abrir o sistema para o público geral realizar as próprias inscrições e pagamentos**, novos vetores de carga, concorrência e segurança entram em jogo.

---

## 2. O Que os Requisitos Não-Funcionais (RNF) Exigem?

Toda decisão de servidor deve cumprir rigorosamente as metas estabelecidas em [requisitos.md](requisitos.md#L194-L261):

| ID | Requisito | Meta Técnica | Impacto Direto na Infraestrutura |
|:---|:---|:---|:---|
| **RNF14** | **Tempo de Resposta da Interface** | **< 200 ms** em condições habituais | Exige latência de rede mínima (< 40ms) e queries indexadas. |
| **RNF13** | **Complexidade das Chaves** | **< 100 ms** para até 128 atletas | Processamento intensivo em CPU (resolvido em RAM pelo Node). |
| **RNF22** | **Compatibilidade** | Node.js v18+ e PostgreSQL v14+ | Sistema operacional base Linux (Ubuntu 22.04 ou 24.04 LTS). |
| **RNF05** | **Gestão Segura de Sessões** | Sessões em banco (`connect-pg-simple`), `secure: true` | Exige terminação TLS/HTTPS via Proxy Reverso (`trust proxy: 1`). |
| **RNF01** | **Criptografia de Senhas** | `bcrypt` com salt rounds = **12** | Operação síncrona/CPU-bound pesada (~300ms de 1 core por hash). |
| **RNF06** | **Proteção Força Bruta** | Rate limit (ex: 10 req / 15 min no login) | Proteção em memória ou via proxy contra abusos e DoS. |
| **RNF12** | **Índices de Performance** | Índices compostos cobrindo buscas e agregações | Evita lentidão no banco mesmo com centenas de inscrições simultâneas. |

---

## 3. Avaliação de Tiers da AWS Lightsail

A AWS Lightsail oferece servidores virtuais (VPS) com tráfego, armazenamento SSD e IP estático inclusos a preço fixo e previsível.

### Comparativo de Planos (Linux / sa-east-1)

```
+------------------------------------------------------------------------------------+
| Tier           | RAM    | vCPUs | SSD   | Custo Aprox. | Parecer Técnico           |
+------------------------------------------------------------------------------------+
| Nano / Micro   | 1 GB   | 1     | 40 GB | ~$5 - $7/mês | ❌ Perigoso (OOM Killer)   |
| Small          | 2 GB   | 2     | 60 GB | ~$10/mês     | 🏆 Sweet Spot (Recomendado)|
| Medium         | 4 GB   | 2     | 80 GB | ~$20/mês     | 🚀 Alta Concorrência / Pico|
| Large          | 8 GB   | 4     | 160 GB| ~$40/mês     | 🏢 Mega Federação (3k+ ath)|
+------------------------------------------------------------------------------------+
```

### Por Que a Instância de 2 GB RAM / 2 vCPUs é o "Sweet Spot"?

1. **Separação de Cores:** Com **2 vCPUs**, o *Event Loop* do Node.js (que roda em single-thread) ganha um núcleo dedicado, enquanto o PostgreSQL e as threads do sistema operacional utilizam o segundo núcleo. Isso impede que uma agregação de ranking ou sorteio de chave congele as respostas web.
2. **Divisão Segura de Memória (Sem risco de *Out-Of-Memory*):**
   * **Linux SO:** ~250 MB a 300 MB
   * **Node.js (Express SSR):** ~120 MB a 250 MB
   * **PostgreSQL (Buffers & Cache):** ~600 MB a 800 MB
   * **Nginx & Logs:** ~30 MB
   * **Margem Livre para Picos:** ~400 MB a 700 MB
3. **Por que NÃO usar a de 1 GB?** Rodar Node.js + PostgreSQL na mesma máquina de 1 GB deixa a margem livre abaixo de 100 MB. Na primeira importação de planilha de inscrições (`exceljs`) ou pico de acessos, o mecanismo de proteção do Linux (*OOM Killer*) mata o processo mais pesado (geralmente o banco de dados), derrubando o campeonato.

---

## 4. A Regra de Ouro da Latência: Onde Criar a Instância?

> [!CAUTION]
> **SELECIONE SEMPRE A REGIÃO DE SÃO PAULO (`sa-east-1`) NO LIGHTSAIL.**

Se você criar a instância na região padrão dos Estados Unidos (`us-east-1` - Virgínia do Norte):
* **Latência de Rede (Ping Brasil ⇄ EUA):** **130ms a 170ms** só de ida e volta pelo cabo submarino.
* **Tempo de Processamento do Node + Postgres:** 15ms.
* **Tempo de Renderização + Handshake HTTPS:** 30ms.
* **Tempo Total de Resposta:** **~180ms a 220ms** ➡️ **Estoura o RNF14 (< 200ms) sem que o código tenha culpa alguma!**

Hospedando em **São Paulo (`sa-east-1`)**:
* **Latência de Rede no Brasil:** **10ms a 35ms**.
* **Tempo Total de Resposta da Interface:** **35ms a 65ms** ➡️ **Cumpre o RNF14 com mais de 65% de folga!**

---

## 5. O Cenário de Inscrições Públicas: A Mudança de Paradigma

Quando a inscrição deixa de ser operada apenas por mesários autorizados e passa a ser feita pelos próprios atletas na internet, ocorrem três transformações:

1. **Volume de Leituras e Visitas Explode:** Antes, apenas quem estava na mesa consultava o sistema; agora, o link é divulgado em redes sociais, stories de academias e grupos de WhatsApp.
2. **Integração de Pagamento em Tempo Real:** O sistema passa a se comunicar com gateways de pagamento (ex: API do Asaas) gerando cobranças PIX dinâmicas e recebendo Webhooks de confirmação.
3. **Acesso não-autenticado:** Rotas públicas ficam expostas a scrapers, bots e cliques duplos de usuários impacientes.

---

## 6. As 4 Pegadinhas Fatais (e Como Desarmá-las)

### 🧨 Pegadinha 1: O "Efeito Manada" no WhatsApp (Fechamento do Lote)

**O Comportamento:** Quase nenhum atleta se inscreve com antecedência. Quando o organizador solta nos grupos: *"ÚLTIMAS 2 HORAS DO LOTE PROMOCIONAL"*, 200 a 400 pessoas abrem a página pelo celular **no mesmo minuto**.

**O Risco:** Se o Node.js precisar entregar o documento HTML, os arquivos CSS, JS de máscaras, SVGs e ícones para 400 clientes simultâneos, a fila de eventos (*event loop*) fica ocupada entregando bytes de arquivos estáticos em vez de processar as validações de inscrição.

**A Solução (Offload via Nginx):**
Configure o **Nginx** na frente do Node. O Nginx atende os arquivos estáticos diretamente do disco, com compactação Gzip/Brotli e cabeçalhos de cache agressivos (`Cache-Control: public, max-age=86400`). O Node.js sequer fica sabendo que o usuário baixou o CSS.

```nginx
# Exemplo de configuração de alta performance no Nginx:
location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2)$ {
    root /var/www/sistema-campeonato/src/public;
    expires 7d;
    add_header Cache-Control "public, no-transform";
    access_log off;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

### 🧨 Pegadinha 2: O Custo Oculto do Bcrypt 12 ([RNF01](requisitos.md#L202))

**O Risco:** O algoritmo `bcrypt` com fator de custo 12 é projetado intencionalmente para ser lento e seguro contra ataques de dicionário. Gerar um hash com `salt = 12` consome cerca de **250ms a 350ms de 100% de uso de uma CPU**.

Se para se inscrever o atleta precisar criar uma conta de usuário com senha, e 10 atletas clicarem em "Criar Conta" ao mesmo tempo, 2 vCPUs ficarão cravadas em 100% por quase 2 segundos. Se alguém utilizar a versão síncrona:

```javascript
// ❌ CATASTRÓFICO: Trava o servidor inteiro por 300ms a cada requisição
const hash = bcrypt.hashSync(senha, 12);

// ✅ CORRETO: Libera o Event Loop para continuar atendendo outros clientes
const hash = await bcrypt.hash(senha, 12);
```

> [!TIP]
> **Decisão de Design Recomendada:** Para inscrições públicas de atletas, evite exigir login tradicional com senha criptografada. Solicite apenas os dados desportivos + CPF e autentique alterações por meio de link mágico/código de acesso temporário enviado por e-mail ou WhatsApp. Reserve a criação de usuários com senha segura e bcrypt 12 para mesários, organizadores e administradores.

---

### 🧨 Pegadinha 3: O Gargalo de Chamada Externa (Asaas / PIX) e Ataques de Cobrança

**O Risco:**
1. Para gerar o QR Code do PIX, seu backend executa uma requisição HTTP externa para a API do Asaas (`https://api.asaas.com/v3/payments`).
2. Essa chamada externa demora entre **400ms e 1.500ms** dependendo do tráfego do gateway.
3. Se um bot ou usuário mal-intencionado submeter um script de submissão em massa no formulário de inscrição, ele pode gerar milhares de cobranças no Asaas, bloqueando sua conta na plataforma de pagamento ou estourando cotas de API.

**A Solução:**
Aplique o middleware `express-rate-limit` especificamente na rota de checkout/inscrição:

```javascript
const rateLimit = require('express-rate-limit');

const limiterInscricao = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo de 10 tentativas por IP
  message: 'Muitas tentativas de inscrição a partir deste endereço. Aguarde alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/inscrever', limiterInscricao, csrfProtection, inscricaoController.inscrever);
```

---

### 🧨 Pegadinha 4: Esgotamento do Pool de Conexões do PostgreSQL

No arquivo [src/config/database.js](file:///c:/Users/rafae/Documents/GitHub/sistema-campeonato/src/config/database.js), o pool padrão do `node-postgres` é inicializado:

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
```

* O padrão do `pg.Pool` aloca até **10 conexões ativas simultâneas**.
* Se você abrir 50 abas de navegadores disparando transações demoradas ou relatórios de ranking pesados sem encerrar a conexão, o pool esgota e as próximas requisições entram em fila de espera, estourando o tempo de 200ms do RNF14.
* **Diretriz:** Certifique-se de que toda transação iniciada com `client = await pool.connect()` contenha o bloco `finally { client.release(); }`. O modelo do projeto já segue esse padrão nos services de avanço e correção.

---

## 7. A Estratégia do "Crescimento Elástico Manual" (Hack de Custo)

Você **não** precisa contratar uma máquina grande e cara para ficar ociosa 30 dias por mês:

```mermaid
graph TD
    A["Dia a Dia / Treinos / Inscrições Iniciais"] -->|Plano $10 / 2 GB RAM| B["Operação Normal Barata"]
    B -->|Aviso: 'Última Semana de Inscrições'| C["Criar Snapshot no Lightsail (1 clique)"]
    C -->|Criar Nova Instância a partir do Snapshot| D["Plano $20 / 4 GB RAM ou $40 / 8 GB"]
    D -->|Transferir IP Estático em 10 segundos| E["Absorve o Pico de Fechamento sem Lentidão"]
    E -->|Encerrou as Inscrições / Começou o Evento| F["Restaura IP de volta para a Instância de $10"]
    F -->|Destrói a Instância Maior| G["Custo Adicional: menos de R$ 15 no mês!"]
```

Essa elasticidade manual aproveita o modelo de cobrança por hora da AWS: você usa a potência máxima apenas no dia do gargalo e volta para a base econômica no restante do tempo.

---

## 8. Arquitetura de Produção Recomendada

A topologia recomendada para uma única instância Lightsail de 2 GB:

```
                  [ Internet / Atletas / Mesários ]
                                  │
                                  ▼ (Portas 80 / 443 - SSL)
                       ┌─────────────────────┐
                       │        Nginx        │
                       │   (Reverse Proxy)   │
                       └──────────┬──────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼ (Arquivos Estáticos: CSS, JS, Imagens)         ▼ (Tráfego Dinâmico: HTTP localhost:3000)
┌──────────────────┐                            ┌──────────────────┐
│  Disco Local SSD │                            │  Node.js (PM2)   │
│   (/src/public)  │                            │  Express 5 + EJS │
└──────────────────┘                            └─────────┬────────┘
                                                          │
                                     ┌────────────────────┴────────────────────┐
                                     ▼ (Pool TCP Local 5432)                   ▼ (HTTPS Assíncrono)
                          ┌───────────────────────┐                 ┌───────────────────────┐
                          │ PostgreSQL 14+ Local  │                 │    API Externa Asaas  │
                          │  (Transações ACID &   │                 │     (Cobranças PIX &  │
                          │   Ledger de Pontos)   │                 │        Webhooks)      │
                          └───────────────────────┘                 └───────────────────────┘
```

---

## 9. Checklist de Inicialização em Produção

Antes de colocar o campeonato no ar na Lightsail, valide cada item:

- [ ] **Instância criada na região `sa-east-1` (São Paulo)** com pelo menos 2 GB de RAM e 2 vCPUs.
- [ ] **Alocação de IP Estático (Static IP)** no painel do Lightsail e atrelado à instância.
- [ ] **Domínio apontado via DNS tipo A** para o IP estático.
- [ ] **Nginx instalado** configurado como proxy reverso para `127.0.0.1:3000` e servindo arquivos estáticos de `/public`.
- [ ] **Certificado SSL gratuito instalado via Certbot:** `sudo certbot --nginx -d seudominio.com.br`.
- [ ] **Firewall do Lightsail:** abrir apenas as portas `22` (SSH), `80` (HTTP) e `443` (HTTPS). A porta `5432` (PostgreSQL) deve permanecer fechada externamente.
- [ ] **Variáveis no `.env` de produção:**
  * `NODE_ENV=production` (ativa `trust proxy: 1` e `secure: true` para cookies).
  * `SESSION_SECRET` com hash aleatório de pelo menos 64 caracteres.
  * `DATABASE_URL=postgresql://usuario:senha@localhost:5432/campeonato`
- [ ] **Gerenciador de Processos PM2 configurado:**
  * Iniciar app: `pm2 start src/app.js --name sistema-campeonato`
  * Salvar inicialização com boot do Linux: `pm2 startup && pm2 save`
- [ ] **Rate Limiting ativado** nas rotas sensíveis (`/login` e formulários públicos de inscrição).
- [ ] **Backup Automático do PostgreSQL:** Cronjob diário gerando dump do banco para armazenamento seguro (`pg_dump`).

---

## 10. Conclusão

O sistema possui uma base arquitetural sólida, leve e em conformidade com as regras do esporte e integridade de dados.

Com o plano de **2 GB de RAM e 2 vCPUs (~$10/mês)** hospedado em **São Paulo**, o sistema opera de forma excelente, com tempo de resposta bem inferior aos **200 ms exigidos pelo RNF14**. Adotando o Nginx como escudo frontal e controlando a taxa de requisições de pagamento, a plataforma suporta com segurança a abertura de inscrições públicas para eventos de centenas a milhares de competidores.
