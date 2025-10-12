# init_db.py
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = ROOT / "desastres.db"


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS estados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estado TEXT NOT NULL,
    uf TEXT NOT NULL,
    capital TEXT NOT NULL,    
    created_at DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS desastres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estado_id INTEGER NOT NULL,    
    evento TEXT NOT NULL,
    clima_descricao TEXT NOT NULL,
    fonte TEXT NOT NULL,
    ano INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (estado_id) REFERENCES estados (id) ON DELETE CASCADE
);
"""


def load_states():
    """Load states data from JSON file"""
    states_file = ROOT / "data" / "estados.json"
    try:
        with open(states_file, "r", encoding="utf-8") as f:
            states_data = json.load(f)
        return [
            (state["id"], state["estado"], state["uf"], state["capital"])
            for state in states_data
        ]
    except FileNotFoundError:
        print(f"Error: Could not find {states_file}")
        return []
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {states_file}")
        return []


def load_desastres():
    """Load disasters data from JSON file"""
    desastres_file = ROOT / "data" / "desastres.json"
    try:
        with open(desastres_file, "r", encoding="utf-8") as f:
            desastres_data = json.load(f)
        return [
            (
                disaster["estado_id"],
                disaster["evento"],
                disaster["clima_descricao"],
                disaster["fonte"],
                disaster["ano"],
            )
            for disaster in desastres_data
        ]
    except FileNotFoundError:
        print(f"Error: Could not find {desastres_file}")
        return []
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {desastres_file}")
        return []


def create_db():
    if DB_PATH.exists():
        DB_PATH.unlink()

    # Load data from JSON files
    states_data = load_states()
    desastres_data = load_desastres()

    if not states_data:
        print("Error: No states data loaded. Cannot create database.")
        return

    if not desastres_data:
        print("Error: No disasters data loaded. Cannot create database.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(SCHEMA)
    cur.executemany(
        "INSERT INTO estados (id, estado, uf, capital) VALUES (?, ?, ?, ?);",
        states_data,
    )
    cur.executemany(
        "INSERT INTO desastres (estado_id, evento, clima_descricao, fonte, ano) VALUES (?, ?, ?, ?, ?);",
        desastres_data,
    )
    conn.commit()
    conn.close()
    print("Banco criado em:", DB_PATH)
    print(f"Inseridos {len(states_data)} estados e {len(desastres_data)} desastres.")


if __name__ == "__main__":
    create_db()
