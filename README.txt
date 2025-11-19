
Projeto: Desastres Naturais por Estado (Back-end + Front-end)
Conteúdo:
- app.py          : API Flask + rota para renderizar templates/index.html
- init_db.py      : cria e popula desastres.db (SQLite)
- desastres.db    : banco já criado
- templates/index.html : HTML enviado por você (Interface M.D.N (V5).txt) convertido
- static/         : pasta criada para arquivos estáticos (vazia)
- requirements.txt: dependências
Como rodar (VS Code / terminal):
1) python -m venv venv
2) Ative venv: venv\Scripts\activate (Windows) ou source venv/bin/activate (Linux/Mac)
3) pip install -r requirements.txt
4) pip install requests flask flask-caching python-dotenv
5) python app.py       # inicia servidor em http://127.0.0.1:5000
Observações:
- O arquivo HTML original foi colocado em templates/index.html.
- Se quiser que eu ajuste o HTML para exibir dinamicamente os dados (ex: fazer fetch('/states') e preencher tabela),
  eu posso modificar index.html e incluir JS que consome a API.
