# 📚 Documentação do Sistema de Campeonato de Jiu-Jitsu

Documentação técnica do banco de dados e regras de negócio.

## Índice

| Arquivo | Conteúdo |
|---------|----------|
| [convencoes.md](convencoes.md) | Convenções gerais do banco de dados |
| [tabelas.md](tabelas.md) | Estrutura de todas as tabelas |
| [logica-categorias.md](logica-categorias.md) | Categorização automática de inscrições |
| [logica-chaves.md](logica-chaves.md) | Geração de chaves eliminatórias e lutas |
| [logica-pontuacao.md](logica-pontuacao.md) | Sistema de pontuação e ranking |
| [migrations.md](migrations.md) | Como rodar migrations e seeds |
| [regras-validacao.md](regras-validacao.md) | O que valida no banco vs. Node.js |

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
