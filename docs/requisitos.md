# 📋 Documento de Requisitos do Sistema de Campeonato de Jiu-Jitsu

Este documento descreve detalhadamente os **Requisitos Funcionais (RF)** e os **Requisitos Não-Funcionais (RNF)** do **Sistema de Gestão de Campeonatos de Jiu-Jitsu**, servindo como especificação técnica de arquitetura, regras de negócio e critérios de qualidade.

---

## 1. Visão Geral do Sistema

O sistema tem como finalidade gerenciar campeonatos e torneios de Jiu-Jitsu de ponta a ponta. Ele contempla desde o cadastro de participantes e equipes até a categorização automática por peso, idade e graduação, sorteio eliminatório com blindagem de confrontos da mesma equipe, árvore de lutas (*brackets*) interativa, lançamento e retificação de resultados, auditoria de operações e apuração contábil do ranking geral das academias em tempo real.

### Principais Atores
- **Administrador / Organizador**: Responsável pelo cadastro de eventos, configuração das regras de pontuação, homologação de inscrições, geração de chaves, apuração e auditoria.
- **Mesário / Operador de Chave**: Responsável pela operação dos combates, lançamento de resultados, observações de luta e pontuações de tatame.
- **Público / Visitante**: Acesso de consulta ao chaveamento, andamento do evento e classificação geral por equipes.

---

## 2. Requisitos Funcionais (RF)

Os requisitos funcionais estão organizados por módulos de domínio da aplicação:

### Módulo 1: Autenticação e Gestão de Acesso

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF01** | Autenticação por E-mail e Senha | O sistema deve permitir que operadores acessem o sistema via e-mail e senha. A busca pelo e-mail deve ser *case-insensitive*. |
| **RF02** | Encerramento de Sessão (Logout) | O sistema deve permitir o encerramento seguro da sessão ativa com invalidação imediata do identificador de sessão. |
| **RF03** | Proteção de Rotas Administrativas | Todas as funcionalidades de gerenciamento (eventos, chaves, equipes, usuários, etc.) devem ser acessíveis apenas por usuários autenticados. |
| **RF04** | Bloqueio de Usuários Inativos | O sistema deve impedir o login de usuários cujo status esteja definido como `ativo = FALSE`, sem apagar seu histórico referencial no banco de dados. |
| **RF05** | Proteção contra Ataques de Força Bruta | O sistema deve limitar a quantidade de tentativas consecutivas de login por IP/tempo (Rate Limiting). |

---

### Módulo 2: Gestão de Usuários

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF06** | Cadastro de Usuários | O sistema deve permitir cadastrar novos operadores informando nome, e-mail único e senha de acesso. |
| **RF07** | Listagem e Edição de Usuários | O sistema deve listar todos os usuários cadastrados e permitir atualizar dados cadastrais (nome e e-mail). |
| **RF08** | Redefinição de Senha | O sistema deve disponibilizar funcionalidade para alteração de senha de qualquer usuário por parte do administrador. |
| **RF09** | Ativação e Desativação de Usuários | O sistema deve permitir desativar ou reativar um usuário a qualquer momento (*soft disable*). |

---

### Módulo 3: Gestão de Faixas e Graduações

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF10** | Cadastro de Faixas com Hierarquia | O sistema deve cadastrar graduações/faixas especificando um nome e um número de `ordem` sequencial (ex: Branca = 1, Azul = 2, Roxa = 3, Marrom = 4, Preta = 5). |
| **RF11** | Reordenação Dinâmica de Faixas | O sistema deve permitir alterar a hierarquia das faixas (ações de "subir" e "descer" ordem) garantindo a renumeração contínua sem lacunas. |
| **RF12** | Edição e Exclusão de Faixas | O sistema deve permitir alterar o nome de faixas ou excluí-las, desde que não estejam associadas a categorias ou inscrições existentes. |
| **RF13** | Comparação Hierárquica por Ordem | Toda comparação de faixas no sistema (ex: faixa mínima e máxima de uma categoria) deve ser calculada estritamente com base na coluna numérica de `ordem`, nunca pelo nome alfabético. |

---

### Módulo 4: Gestão de Equipes (Academias)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF14** | Cadastro de Equipes | O sistema deve permitir cadastrar academias/equipes com nome único (*case-insensitive*). |
| **RF15** | Escopo Global de Equipes | As equipes cadastradas devem ser compartilhadas globalmente entre todos os eventos, permitindo histórico contínuo em diferentes campeonatos. |
| **RF16** | Edição e Exclusão de Equipes | O sistema deve permitir atualizar a razão/nome da equipe ou excluí-la (caso não possua competidores vinculados a inscrições ou pontuações). |

---

### Módulo 5: Gestão de Eventos (Campeonatos)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF17** | Cadastro de Eventos | O sistema deve permitir cadastrar campeonatos informando nome e descrição/regulamento livre. |
| **RF18** | Painel Central do Evento (Dashboard) | O sistema deve disponibilizar uma tela central para cada evento com visão consolidada: total de inscritos, categorias ativas, chaves geradas, acesso rápido ao ranking e logs de auditoria. |
| **RF19** | Edição e Exclusão de Eventos | O sistema deve permitir a alteração dos dados do evento ou exclusão integral (com remoção em cascata controlada dos dados dependentes). |

---

### Módulo 6: Gestão de Categorias

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF20** | Criação Multicritério de Categorias | O sistema deve permitir criar categorias vinculadas a um evento específico, definindo opcionalmente: idade mínima/máxima, peso mínimo/máximo, faixa mínima/máxima e sexo (`MASCULINO`, `FEMININO` ou `MISTO`). |
| **RF21** | Suporte a Limites Abertos | O sistema deve interpretar valores `NULL` nos campos de idade, peso ou faixa como ausência de restrição (ex: "até 70 kg", "a partir de 30 anos" ou categoria Absoluto). |
| **RF22** | Validação Hierárquica e Dimensional | O sistema deve validar no cadastro da categoria: `idade_minima <= idade_maxima`, `peso_minimo <= peso_maximo` e `ordem(faixa_minima) <= ordem(faixa_maxima)`. |
| **RF23** | Bloqueio de Alteração com Chave Existente | O sistema deve impedir a exclusão ou alteração estrutural de uma categoria que já possua chave eliminatória gerada em andamento. |

---

### Módulo 7: Gestão de Inscrições e Atletas

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF24** | Registro de Atletas por Evento | O sistema deve permitir inscrever atletas vinculados a um evento, informando: nome, equipe, faixa, idade, peso e sexo. |
| **RF25** | Atribuição de Cabeça de Chave (*Seed*) | O sistema deve permitir indicar a posição de cabeça de chave (*seed*) de um atleta, aceitando inteiros positivos sem lacunas iniciando em 1. |
| **RF26** | Categorização Automática de Atletas | Ao registrar ou editar uma inscrição, o sistema deve avaliar os critérios das categorias do evento: <br>• **1 compatível**: associa automaticamente a inscrição à categoria.<br>• **2 ou mais compatíveis**: sugere as opções para escolha do operador.<br>• **0 compatíveis**: mantém a inscrição como pendente para ajuste ou criação de nova categoria. |
| **RF27** | Proteção de Evento Cruzado | O sistema deve validar rigorosamente que a categoria atribuída à inscrição pertença obrigatoriamente ao mesmo evento da inscrição. |
| **RF28** | Ciclo de Status da Inscrição | O sistema deve gerenciar os estados da inscrição: `PENDENTE`, `CONFIRMADA`, `CANCELADA` e `DESCLASSIFICADA`. |
| **RF29** | Reativação e Cancelamento | O sistema deve permitir cancelar e reativar inscrições com recálculo automático de elegibilidade para geração de chaves. |
| **RF30** | Filtros e Pesquisa de Inscrições | A listagem de inscrições deve fornecer filtros por status, categoria, equipe e busca por nome do atleta. |

---

### Módulo 8: Geração e Sorteio de Chaves Eliminatórias (*Brackets*)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF31** | Elegibilidade para Chaveamento | O sistema só deve permitir gerar chaves eliminatórias para categorias que possuam no mínimo 2 atletas com status `CONFIRMADA`. |
| **RF32** | Dimensionamento por Potência de 2 | A chave deve ser dimensionada automaticamente para a próxima potência de 2 baseada no total de inscritos (2, 4, 8, 16, 32, 64 ou 128 competidores). |
| **RF33** | Posicionamento Fixo dos *Seeds* | Os atletas cabeças de chave devem ser posicionados de acordo com a ordem padrão internacional de torneios (Seed 1 e Seed 2 em polos opostos da chave, só podendo se cruzar na final). |
| **RF34** | Distribuição Inteligente de *BYEs* | Quando o número de competidores for inferior ao tamanho da chave, o sistema deve alocar vagas livres (*BYE*) com as seguintes regras:<br>1. Beneficiar primeiramente os cabeças de chave.<br>2. Garantir que **nunca** ocorra confronto entre dois BYEs (*BYE x BYE*). |
| **RF35** | Proteção contra Confrontos da Mesma Equipe | O algoritmo de sorteio deve utilizar embaralhamento criptográfico (Fisher-Yates via `crypto.randomInt`) e otimização para separar atletas da mesma equipe na 1ª rodada da chave. |
| **RF36** | Re-sorteio de Chave | O sistema deve permitir sortear novamente os confrontos caso a chave ainda esteja no status `NAO_INICIADA`. |
| **RF37** | Inicialização da Chave e Avanço de *BYEs* | Ao iniciar a chave, o sistema deve atualizar seu status para `EM_ANDAMENTO` e avançar de forma automática e imediata todos os atletas que caíram em chave com *BYE* para a rodada seguinte. |
| **RF38** | Exclusão de Chave | O sistema deve permitir excluir uma chave gerada caso ela esteja em `NAO_INICIADA`, liberando as inscrições para novo sorteio. |

---

### Módulo 9: Árvore Visual de Lutas (*Bracket Tree*)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF39** | Visualização Gráfica do Torneio | O sistema deve renderizar a chave no formato horizontal de árvore eliminatória clássica, agrupada por rodadas (Oitavas, Quartas, Semifinais e Final). |
| **RF40** | Sinalização de Status dos Combates | Cada luta na árvore deve exibir visualmente seu estado: `AGUARDANDO`, `PRONTA`, `FINALIZADA` ou `CANCELADA`. |
| **RF41** | Identificação dos Lutadores e Equipes | Cada nó de combate deve indicar os nomes dos competidores, faixas, equipes, pontos marcados na luta e o vencedor destacado. |
| **RF42** | Suporte a Temas e Identidade Visual | O sistema deve renderizar o layout com suporte a temas visuais customizáveis (*white-label*), aplicando paletas de cores, badges e tipografia da organização do evento. |

---

### Módulo 10: Lançamento de Resultados e Avanço de Lutas

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF43** | Lançamento de Resultado de Combate | O sistema deve disponibilizar formulário para inserção do resultado em qualquer luta que esteja com status `PRONTA`. |
| **RF44** | Tipos de Vitória Homologados | O sistema deve registrar a forma de vitória: `PONTOS`, `FINALIZACAO`, `DECISAO`, `WO`, `DESCLASSIFICACAO` ou `BYE`. |
| **RF45** | Placar e Observações | O sistema deve permitir o preenchimento opcional da contagem de pontos/vantagens dos competidores e observações do árbitro. |
| **RF46** | Avanço Atômico de Fase | Após o lançamento do resultado, o sistema deve, em transação atômica:<br>1. Definir o vencedor e perdedor da luta.<br>2. Alocar o vencedor no slot exato (`proximo_slot` 1 ou 2) da `proxima_luta_id`.<br>3. Atualizar a próxima luta para `PRONTA` caso ambos os slots estejam preenchidos.<br>4. Atribuir pontos de vitória para a equipe correspondente. |

---

### Módulo 11: Correção, Anulação e Retificação de Lutas (Rollback)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF47** | Correção de Resultados Lançados | O sistema deve permitir corrigir o resultado de uma luta finalizada, alterando o vencedor, tipo de vitória ou placar. |
| **RF48** | Anulação de Resultados | O sistema deve permitir anular completamente o resultado de uma luta, retornando seu status para `PRONTA`. |
| **RF49** | Validação de Dependência Posterior | O sistema deve bloquear qualquer correção ou anulação se o atleta vencedor já tiver disputado ou finalizado a luta da rodada seguinte, exigindo que o operador anule primeiramente as lutas posteriores (*rollback ordenado*). |
| **RF50** | Estorno Automático de Pontuações | Toda correção ou anulação de luta deve estornar ou reatribuir de forma atômica os pontos lançados para a equipe do vencedor no extrato contábil. |

---

### Módulo 12: Finalização de Categoria, Pódio e Premiação

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF51** | Apuração Automática do Pódio | Após o encerramento da luta final, o sistema deve calcular o pódio automaticamente:<br>• **1º Lugar (Campeão)**: Vencedor da final.<br>• **2º Lugar (Vice-Campeão)**: Perdedor da final.<br>• **3º Lugar**: Perdedor da semifinal disputada pelo campeão (ou da outra semifinal caso o campeão tenha avançado por *BYE*). |
| **RF52** | Tratamento de Chave de 2 Atletas | Em chaves com apenas 2 participantes, o sistema não deve gerar 3º colocado (`terceiro_lugar_id = NULL`). |
| **RF53** | Prévia de Finalização | O sistema deve exibir uma tela de conferência com os nomes dos medalhistas e os pontos que serão creditados às equipes antes de confirmar o encerramento. |
| **RF54** | Edição Manual de Colocações | O sistema deve permitir que o organizador ajuste manualmente os atletas do pódio, exigindo justificativa formal e registrando data, hora e usuário responsável. |
| **RF55** | Validação dos Colocados | O sistema deve impedir que a mesma pessoa ocupe duas posições no pódio e validar se todos os atletas selecionados pertencem à categoria da chave. |
| **RF56** | Reabertura de Categoria Finalizada | O sistema deve permitir reabrir uma chave concluída, estornando automaticamente do extrato das equipes todos os pontos de colocação (1º, 2º e 3º lugares) concedidos. |

---

### Módulo 13: Sistema Contábil de Pontuação de Equipes (*Ledger*)

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF57** | Regras de Pontuação Configuráveis por Evento | Cada evento deve possuir uma parametrização própria de pontuação definindo: pontos por vitória, pontos por 1º lugar, pontos por 2º lugar, pontos por 3º lugar e flag se vitória por *BYE* pontua. |
| **RF58** | Registro em Extrato Imutável (*Ledger*) | O sistema não deve manter um campo estático de saldo de pontos na tabela de equipes. Todo ponto deve ser um lançamento individual na tabela `pontos_equipes` com indicação de evento, equipe, inscrição, luta ou chave de origem e tipo (`VITORIA`, `PRIMEIRO_LUGAR`, `SEGUNDO_LUGAR`, `TERCEIRO_LUGAR`, `AJUSTE`, `PENALIDADE`). |
| **RF59** | Proteção contra Duplicidade de Pontos | O sistema deve impedir lançamentos duplicados de pontos para a mesma luta ou mesma colocação de chave por meio de constraints e índices parciais no banco de dados. |
| **RF60** | Lançamentos de Ajustes e Penalidades | O sistema deve permitir que o organizador insira lançamentos manuais avulsos de bonificação (ajustes positivos) ou punição (penalidades com pontos negativos) para qualquer equipe. |

---

### Módulo 14: Ranking Geral em Tempo Real

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF61** | Classificação Geral por Evento | O sistema deve exibir a tabela de classificação das equipes calculando o total acumulado em tempo real (`SUM(pontos)`) a partir dos lançamentos do extrato. |
| **RF62** | Critérios de Desempate | O sistema deve ordenar o ranking decrescente por total de pontos e, em caso de empate, por ordem alfabética da equipe. |
| **RF63** | Extrato Detalhado por Equipe | O sistema deve permitir clicar em qualquer equipe do ranking para visualizar o detalhamento completo de todas as pontuações obtidas (atleta, luta, colocação, pontos e data). |

---

### Módulo 15: Auditoria e Rastreabilidade

| ID | Requisito | Descrição |
|:---|:---|:---|
| **RF64** | Rastreabilidade de Operações Críticas | O sistema deve registrar em tabela de auditoria (`logs_auditoria`) todas as ações relevantes: criação/edição/cancelamento de inscrições, geração/sorteio de chaves, lançamento/correção/anulação de resultados e finalização/reabertura de categorias. |
| **RF65** | Snapshot de Dados (*Diff* JSONB) | Cada registro de auditoria deve armazenar `dados_anteriores` e `dados_novos` em formato JSONB, permitindo auditoria forense do estado anterior e posterior da entidade. |
| **RF66** | Sanitização Automática de Dados Sensíveis | O serviço de auditoria deve expurgar automaticamente senhas, tokens CSRF, segredos e cookies antes de persistir o snapshot no log. |
| **RF67** | Painel de Consulta de Auditoria | O sistema deve fornecer tela de consulta ao histórico de auditoria do evento com suporte a filtros por tipo de ação, operador e paginação. |

---

## 3. Requisitos Não-Funcionais (RNF)

Os requisitos não-funcionais especificam critérios de qualidade técnica, segurança, desempenho, integridade e arquitetura do software (baseados na norma **ISO/IEC 25010**):

### Categoria 1: Segurança (Security)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF01** | Criptografia Forte de Senhas | Todas as senhas de usuários devem ser protegidas utilizando o algoritmo **bcrypt** com fator de custo (*salt rounds*) igual a **12**. Nenhuma senha pode ser armazenada em texto puro. |
| **RNF02** | Proteção contra CSRF | Todas as requisições de alteração de estado (rotas `POST`) devem exigir validação de token anti-CSRF utilizando o pacote `csrf-sync`, com tokens atrelados à sessão segura do usuário. |
| **RNF03** | Cabeçalhos de Segurança HTTP | A aplicação deve implementar proteção de cabeçalhos HTTP via middleware **Helmet** (proteção contra *MIME-sniffing*, *clickjacking*, *XSS*, etc.). |
| **RNF04** | Prevenção contra SQL Injection | Todas as interações com o banco de dados PostgreSQL devem utilizar estritamente consultas parametrizadas (`$1, $2, ...`) via pool do driver `pg`. Nenhuma query pode concatenar variáveis diretamente. |
| **RNF05** | Gestão Segura de Sessões | As sessões de usuários devem ser mantidas no banco de dados via `connect-pg-simple`, com cookies configurados com os atributos `httpOnly: true`, `sameSite: 'lax'`, e `secure: true` em ambiente de produção atrás de proxy reverso (`trust proxy`). |
| **RNF06** | Mitigação de Ataques de Força Bruta | Rotas sensíveis (como `/login`) devem possuir limitação de requisições por IP via `express-rate-limit` (máximo de 10 tentativas a cada 15 minutos em produção). |
| **RNF07** | Não Vazamento de Informações Sensíveis | Em ambiente de produção, mensagens de erro não devem expor rastros de pilha de execução (*stacktraces*). A tela de auditoria deve sanitizar tokens e hashes. |

---

### Categoria 2: Confiabilidade e Integridade de Dados (Reliability & Integrity)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF08** | Validação em Duas Camadas | O sistema deve assegurar integridade por meio de validação dupla:<br>1. **Camada de Banco (PostgreSQL)**: Restrições duras (`CHECK`, `FOREIGN KEY`, `UNIQUE`). Ex: pesos positivos, sexo válido, vencedor ≠ perdedor, colocados distintos.<br>2. **Camada de Aplicação (Node.js)**: Validações lógicas relacionais (mesmo evento entre categoria e inscrição, ordem hierárquica de faixas, integridade da chave). |
| **RNF09** | Transações Atômicas (ACID) | Todas as operações compostas que envolvam mais de uma tabela (ex: avanço de chave com pontuação, correção de luta com estorno, finalização com pódio) devem ser executadas dentro de blocos transacionais explícitos (`BEGIN ... COMMIT / ROLLBACK`). |
| **RNF10** | Modelo Contábil de Extrato (*Append-Only Ledger*) | A pontuação de equipes deve ser modelada exclusivamente como extrato contábil de lançamentos. O total deve ser sempre a soma dinâmica dos registros, eliminando riscos de condições de corrida (*race conditions*) ou perda de sincronismo de saldo. |
| **RNF11** | Índices Anti-Duplicação | O banco de dados deve implementar índices únicos parciais impedindo fisicamente que uma mesma luta gere mais de uma bonificação por vitória ou que uma mesma chave gere mais de um 1º, 2º ou 3º lugares. |

---

### Categoria 3: Desempenho e Eficiência (Performance & Efficiency)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF12** | Otimização de Consultas via Índices | As tabelas do banco de dados devem possuir índices compostos cobrindo os cenários mais frequentes:<br>• `(evento_id, status)` e `(categoria_id, status)` em `inscricoes`<br>• `(chave_id, rodada, posicao)` em `lutas`<br>• `(evento_id, equipe_id)` em `pontos_equipes`<br>• `(evento_id, created_at DESC)` em `logs_auditoria`. |
| **RNF13** | Complexidade Algorítmica das Chaves | O gerador de chaves e o algoritmo de separação de equipes devem operar com complexidade $O(N \log N)$ para categorias de até 128 atletas, gerando o chaveamento completo em menos de 100 milissegundos. |
| **RNF14** | Tempo de Resposta da Interface | Consultas usuais de painéis, extratos e tabelas de ranking devem responder em tempo inferior a 200 milissegundos sob condições habituais de operação. |

---

### Categoria 4: Usabilidade e Experiência do Usuário (Usability & UX)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF15** | Design Responsivo e Fluido | As telas devem ser totalmente adaptadas para computadores de mesa, notebooks, tablets e dispositivos móveis utilizados nos tatames e mesas de pesagem. |
| **RNF16** | Visualização Ergonômica de Chaves | A interface da árvore eliminatória deve oferecer navegação clara, linhas de conexão entre rodadas e diferenciação de estados por meio de *badges* e cores padronizadas. |
| **RNF17** | Notificações e Feedback Imediato | Toda ação de cadastro, edição ou erro deve fornecer retorno imediato por meio de mensagens temporárias (*flash messages*) com contexto claro de sucesso ou falha. |
| **RNF18** | Arquitetura de Temas (*White-Label*) | O sistema deve isolar a identidade visual por meio de configurações modulares de tema (`brand.js` e folhas de estilo CSS desacopladas), possibilitando customização para diferentes organizadores. |

---

### Categoria 5: Manutenibilidade e Arquitetura de Software (Maintainability)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF19** | Padrão Arquitetural em Camadas | O código-fonte deve ser organizado estritamente no padrão multicamadas:<br>• `controllers`: orquestração de requisição/resposta web.<br>• `services`: isolamento puro das regras de negócio.<br>• `repositories`: persistência e consultas SQL.<br>• `validators`: sanitização e validação de schema.<br>• `middlewares`: tratamento transversal (autenticação, csrf, segurança).<br>• `views`: templates EJS sem lógica de negócios embutida. |
| **RNF20** | Controle de Versão de Banco de Dados | O esquema do banco de dados deve ser gerenciado por meio de *migrations* SQL versionadas sequencialmente (`001_...sql` a `014_...sql`), permitindo recriação determinística do banco via script `npm run migrate`. |
| **RNF21** | Cobertura de Testes Automatizados | O repositório deve manter scripts de testes integrados e unitários cobrindo as fases funcionais (Fases 5 a 18: eventos, faixas, equipes, categorias, inscrições, pontuação, chaves, brackets, resultados, correções, finalização e ranking). |

---

### Categoria 6: Portabilidade e Compatibilidade (Portability & Standards)

| ID | Requisito | Especificação Técnica |
|:---|:---|:---|
| **RNF22** | Compatibilidade de Ambiente | A aplicação deve rodar sobre ambiente Node.js LTS (v18+) e banco de dados relacional PostgreSQL (v14+). |
| **RNF23** | Configuração via Variáveis de Ambiente | Todas as configurações de infraestrutura (banco de dados, porta, segredos de sessão, ambiente de execução) devem ser desacopladas do código e carregadas via arquivo `.env`. |
| **RNF24** | Conformidade com Regras de Esportes de Combate | O sistema deve aderir aos regulamentos e práticas desportivas consagradas do Jiu-Jitsu (divisões de faixa, regras de peso na inscrição, chaveamento olímpico com cabeças de chave e pódio triplo). |
