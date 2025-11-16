import os
import sqlite3
import requests
from dotenv import load_dotenv
from flask import Flask, g, jsonify, render_template, request
from flask_caching import Cache

# -------------------------------
# Configurações e variáveis
# -------------------------------
load_dotenv()
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")

ROOT = os.path.dirname(__file__)
DB_PATH = os.path.join(ROOT, "municipios.db")

app = Flask(__name__, static_folder="static", template_folder="templates")
cache = Cache(app)


# -------------------------------
# Conexão com o banco de dados
# -------------------------------
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        g._database = db
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db:
        db.close()


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


# -------------------------------
# Páginas principais
# -------------------------------
@app.route("/")
def pag_inicial():
    return render_template("pag_inicial.html")


@app.route("/mapa")
def home():
    return render_template("index.html")


@app.route("/ping")
def ping():
    return jsonify({"status": "ok"})


# -------------------------------
# 🔹 API: Municípios e desastres
# -------------------------------
@app.route("/api/municipios", methods=["GET"])
def get_municipios():
    """
    Retorna registros de municípios e desastres com filtros opcionais:
      - estado (Sigla_UF)
      - cidade (Nome_Municipio)
      - ano (últimos 4 dígitos da Data_Evento)
      - limit, offset → paginação
    """
    estado = request.args.get("estado")
    cidade = request.args.get("cidade")
    ano = request.args.get("ano")
    limit = request.args.get("limit", 200, type=int)  # padrão 200 registros por vez
    offset = request.args.get("offset", 0, type=int)

    db = get_db()
    cur = db.cursor()

    query = """
        SELECT 
            Nome_Municipio,
            Sigla_UF,
            descricao_tipologia,
            grupo_de_desastre,
            Data_Evento,
            DH_FERIDOS,
            DH_MORTOS
        FROM municipios
        WHERE 1=1
    """
    params = []

    if estado:
        query += " AND Sigla_UF = ?"
        params.append(estado)

    if cidade:
        query += " AND Nome_Municipio LIKE ?"
        params.append(f"%{cidade}%")

    if ano:
        query += " AND substr(Data_Evento, 7, 4) = ?"
        params.append(ano)

    query += """
        ORDER BY
          (substr(Data_Evento, 7, 4) || '-' || substr(Data_Evento, 4, 2) || '-' || substr(Data_Evento, 1, 2)) DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    cur.execute(query, params)
    rows = [row_to_dict(r) for r in cur.fetchall()]

    # 🔹 Pega o total geral (para saber quantas páginas há)
    cur.execute("SELECT COUNT(*) AS total FROM municipios")
    total = cur.fetchone()["total"]

    return jsonify({
        "rows": rows,
        "limit": limit,
        "offset": offset,
        "total": total
    })



# -------------------------------
# 🔹 Resumo por estado (para o mapa)
# -------------------------------
@app.route("/api/estados_resumo", methods=["GET"])
def get_estados_resumo():
    """
    Retorna total de eventos por UF, com filtro opcional por ano.
    """
    ano = request.args.get("ano", "").strip()
    db = get_db()
    cur = db.cursor()

    if ano:
        # filtra pelo ano (últimos 4 caracteres de Data_Evento)
        cur.execute("""
            SELECT 
                Sigla_UF AS uf,
                COUNT(*) AS total
            FROM municipios
            WHERE substr(Data_Evento, -4) = ?
            GROUP BY Sigla_UF
            ORDER BY Sigla_UF
        """, (ano,))
    else:
        # sem filtro
        cur.execute("""
            SELECT 
                Sigla_UF AS uf,
                COUNT(*) AS total
            FROM municipios
            GROUP BY Sigla_UF
            ORDER BY Sigla_UF
        """)

    rows = [row_to_dict(r) for r in cur.fetchall()]
    return jsonify(rows)



# -------------------------------
# 🔹 Filtros (para dropdowns)
# -------------------------------
@app.route("/api/filtros", methods=["GET"])
def get_filtros():
    """Retorna listas únicas de estados, municípios e anos (descendente)."""
    db = get_db()
    cur = db.cursor()

    estados = [r["Sigla_UF"] for r in cur.execute(
        "SELECT DISTINCT Sigla_UF FROM municipios WHERE Sigla_UF IS NOT NULL ORDER BY Sigla_UF"
    ).fetchall()]

    municipios = [r["Nome_Municipio"] for r in cur.execute(
        "SELECT DISTINCT Nome_Municipio FROM municipios WHERE Nome_Municipio IS NOT NULL ORDER BY Nome_Municipio"
    ).fetchall()]

    anos = [r["ano"] for r in cur.execute(
        "SELECT DISTINCT substr(Data_Evento, 7, 4) AS ano FROM municipios WHERE Data_Evento IS NOT NULL ORDER BY ano DESC"
    ).fetchall() if r["ano"]]

    return jsonify({
        "estados": estados,
        "municipios": municipios,
        "anos": anos
    })

# -----------------------------------------------
# 🔹 Filtros de cidades dependentes do estado
# -----------------------------------------------
@app.route("/api/municipios_por_estado", methods=["GET"])
def get_municipios_por_estado():
    estado = request.args.get("estado")
    if not estado:
        return jsonify([])

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
        SELECT DISTINCT Nome_Municipio
        FROM municipios
        WHERE Sigla_UF = ?
        ORDER BY Nome_Municipio
        """,
        (estado,)
    )
    municipios = [r["Nome_Municipio"] for r in cur.fetchall()]
    return jsonify(municipios)



# -------------------------------
# 🔹 Pesquisa geral
# -------------------------------
@app.route("/search", methods=["GET"])
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    q_like = f"%{q}%"

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
        SELECT *
        FROM municipios
        WHERE
            Nome_Municipio LIKE ?
            OR Sigla_UF LIKE ?
            OR descricao_tipologia LIKE ?
            OR grupo_de_desastre LIKE ?
        ORDER BY (substr(Data_Evento, 7, 4) || '-' || substr(Data_Evento, 4, 2) || '-' || substr(Data_Evento, 1, 2)) DESC
        """,
        (q_like, q_like, q_like, q_like),
    )
    rows = [row_to_dict(r) for r in cur.fetchall()]
    return jsonify(rows)


# -------------------------------
# 🔹 Clima (mantido)
# -------------------------------
@app.route("/weather", methods=["GET"])
@cache.cached(timeout=600, query_string=True)
def get_weather():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Query is required"}), 400

    weather_data = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={
            "q": q,
            "appid": OPENWEATHERMAP_API_KEY,
            "units": "metric",
            "lang": "pt_br",
        },
    ).json()

    if weather_data.get("cod") != 200:
        return jsonify({"error": "City not found"}), 404

    return jsonify(weather_data)

# -------------------------------
# Execução principal
# -------------------------------
if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("⚠️  Banco municipios.db não encontrado!")
    app.run(debug=True, host="127.0.0.1", port=5000)
