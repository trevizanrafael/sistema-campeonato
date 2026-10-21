# 📚 Documentação do Sistema de Campeonato de Jiu-Jitsu

Documentação técnica do banco de dados e regras de negócio.

## Índice

| Arquivo | Conteúdo |
|---------|----------|
| [requisitos.md](requisitos.md) | Especificação de Requisitos Funcionais (RF) e Não-Funcionais (RNF) |
| [convencoes.md](convencoes.md) | Convenções gerais do banco de dados |
| [tabelas.md](tabelas.md) | Estrutura de todas as tabelas |
| [logica-categorias.md](logica-categorias.md) | Categorização automática de inscrições |
| [logica-chaves.md](logica-chaves.md) | Geração de chaves eliminatórias e lutas |
| [logica-pontuacao.md](logica-pontuacao.md) | Sistema de pontuação e ranking |
| [migrations.md](migrations.md) | Como rodar migrations e seeds |
| [regras-validacao.md](regras-validacao.md) | O que valida no banco vs. Node.js |
| [manual-sobrevivencia-lightsail.md](manual-sobrevivencia-lightsail.md) | Guia de infraestrutura na AWS Lightsail, dimensionamento e armadilhas do público aberto |
| [roadmap-inscricoes-atletas-google-oauth.md](roadmap-inscricoes-atletas-google-oauth.md) | Roadmap do Portal do Atleta, inscrições públicas, checkout Asaas e Google OAuth 100% |

## Estrutura do Projeto

```
src/
├── config/
│   ├── database.js          # Pool de conexão PostgreSQL
│   ├── migrate.js            # Runner de migrations
│   ├── seed.js               # Criação do admin com bcrypt
│   └── migrations/           # Arquivos SQL em ordem
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── views/
│   ├── layouts/
│   ├── partials/
│   ├── auth/
│   ├── eventos/
│   ├── categorias/
│   ├── equipes/
│   ├── inscricoes/
│   ├── chaves/
│   └── usuarios/
├── public/
│   ├── css/
│   └── js/
└── app.js
```
