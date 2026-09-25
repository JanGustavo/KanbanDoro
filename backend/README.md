# KanbanDoro API

API experimental em FastAPI e SQLite. Instale com `pip install -e '.[dev]'` nesta pasta e execute `uvicorn app.main:app --reload`. Configure `JWT_SECRET` no `.env` antes de expor a API; veja `.env.example`.

O quadro da extensão ainda usa armazenamento local. Esta API não sincroniza os dados da extensão nem chama um provedor de IA. Não coloque a chave de IA no cadastro: a chave fica no navegador até existir um fluxo de integração explícito e seguro.
