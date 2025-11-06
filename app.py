import os
import sqlite3
import requests
from dotenv import load_dotenv
from flask import Flask, g, jsonify, render_template, request
from flask_caching import Cache

load_dotenv()
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")

ROOT = os.path.dirname(__file__)
DB_PATH = os.path.join(ROOT, "desastres.db")

app = Flask(__name__, static_folder="static", template_folder="templates")
cache = Cache(app)


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

@app.route("/")
def pag_inicial():
    return render_template("pag_inicial.html")

@app.route("/mapa")
def home():
    return render_template("index.html")


@app.route("/ping")
def ping():
    return jsonify({"status": "ok"})


@app.route("/states", methods=["GET"])
def list_states():
    """Retorna os estados e seus desastres associados."""
    db = get_db()
    cur = db.cursor()
    cur.execute("""
        SELECT 
            estados.id,
            estados.estado,
            estados.uf,
            estados.capital,
            desastres.evento,
            desastres.clima_descricao,
            desastres.fonte,
            desastres.ano
        FROM estados
        LEFT JOIN desastres ON estados.id = desastres.estado_id
        ORDER BY estados.estado, desastres.ano DESC
    """)
    rows = [row_to_dict(r) for r in cur.fetchall()]
    return jsonify(rows)



@app.route("/states/<string:uf>", methods=["GET"])
def get_state(uf):
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT estados.*, count(desastres.id) as total_disasters FROM estados join desastres ON estados.id = desastres.estado_id WHERE uf = ? COLLATE NOCASE",
        (uf.upper(),),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/disasters", methods=["GET"])
def list_disasters():
    """Retorna lista completa de desastres."""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT desastres.*, estados.estado, estados.uf, estados.capital FROM desastres JOIN estados ON desastres.estado_id = estados.id ORDER BY ano DESC"
    )
    rows = [row_to_dict(r) for r in cur.fetchall()]
    return jsonify(rows)


@app.route("/states/<string:uf>/disasters", methods=["GET"])
def get_state_disasters(uf):
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM desastres JOIN estados ON desastres.estado_id = estados.id WHERE uf = ? COLLATE NOCASE ORDER BY ano DESC",
        (uf.upper(),),
    )
    rows = [row_to_dict(r) for r in cur.fetchall()]
    if not rows:
        return jsonify({"error": "Not found"}), 404
    return jsonify(rows)


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
        SELECT * FROM desastres
        JOIN estados ON desastres.estado_id = estados.id
        WHERE
        estado LIKE ? OR uf LIKE ? OR capital LIKE ? OR evento LIKE ? OR clima_descricao LIKE ? OR fonte LIKE ?
        ORDER BY estado
    """,
        (q_like, q_like, q_like, q_like, q_like, q_like),
    )
    rows = [row_to_dict(r) for r in cur.fetchall()]
    return jsonify(rows)


@app.route("/weather", methods=["GET"])
@cache.cached(timeout=600, query_string=True)  # cache por cidade (via query_string)
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


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Banco não encontrado. Rode 'python init_db.py' para criar desastres.db.")
    app.run(debug=True, host="127.0.0.1", port=5000)
