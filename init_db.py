# init_db.py
import sqlite3, os

ROOT = os.path.dirname(__file__)
DB_PATH = os.path.join(ROOT, "desastres.db")

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS desastres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estado TEXT NOT NULL,
    uf TEXT NOT NULL,
    capital TEXT NOT NULL,
    evento TEXT NOT NULL,
    clima_descricao TEXT NOT NULL,
    fonte TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_desastres_uf ON desastres(uf);
"""

DATA = [
    ("Acre","AC","Rio Branco","Cheia do Rio Acre — fev-mar 2015","Chuvas intensas na estação úmida; rios em cheia por vários dias/semana.","Agência Brasil (cheia do Acre, fev-2015)."),
    ("Alagoas","AL","Maceió","Enchentes em Alagoas e Pernambuco — junho de 2010","Precipitação muito acima da média por vários dias; rios e bacias transbordaram.","Relatos sobre as enchentes de junho/2010."),
    ("Amapá","AP","Macapá","Inundações/enchentes urbanas recorrentes — episódios 2000s–2020s","Chuvas intensas somadas a marés altas/estuarinas e drenagem insuficiente.","Atlas/estudo sobre inundações no Amapá."),
    ("Amazonas","AM","Manaus","Cheias históricas do Rio Negro — 2012 / 2021","Estação úmida com precipitação contínua por semanas; rios em níveis recorde.","Relatos da cheia do Rio Negro (Manaus 2021/2012)."),
    ("Bahia","BA","Salvador","Enchentes no sul/centro-sul — dez 2021","Múltiplos dias de chuva muito intensa; precipitação fora da média e prolongada.","Notícias e análises sobre as chuvas de dez/2021."),
    ("Ceará","CE","Fortaleza","Grande Seca — 1877–1879","Longos anos com chuva muito abaixo da média; estiagem severa e prolongada.","Revisão histórica sobre a Grande Seca (1877–1879)."),
    ("Distrito Federal","DF","Brasília","Alagamentos urbanos — episódios recentes","Regime: seca intercalada com pancadas convectivas muito intensas que geram alagamentos.","Estudos sobre temporais e alagamentos no DF."),
    ("Espírito Santo","ES","Vitória","Enchentes e deslizamentos — dez 2013","Chuvas persistentes e intensas sobre encostas; solo saturado e movimentos de massa.","Relatórios sobre as chuvas de dez/2013 no ES."),
    ("Goiás","GO","Goiânia","Enxurradas urbanas — ex.: Anápolis, 2021","Chuvas fortes e concentradas em curto período (enxurradas urbanas).","Reportes sobre enxurrada em Anápolis (2021)."),
    ("Maranhão","MA","São Luís","Cheias e inundações costeiras/urbanas — 2000s–2010s","Chuvas intensas somadas a marés/transbordamentos; precipitação prolongada.","Relatos sobre alagamentos e inundações em São Luís."),
    ("Mato Grosso","MT","Cuiabá","Cheias sazonais no Pantanal / secas 2019–2020","Estação chuvosa com enchentes prolongadas; em anos de seca, déficit hídrico favorece incêndios.","Relatos sobre Pantanal (secas e incêndios 2020)."),
    ("Mato Grosso do Sul","MS","Campo Grande","Pantanal: incêndios/seca — 2020/2024","Estiagem severa em anos recentes, secas prolongadas que favoreceram queimadas; anos chuvosos trazem enchentes.","Reportagens sobre incêndios / seca no Pantanal (MS)."),
    ("Minas Gerais","MG","Belo Horizonte","Enchentes e deslizamentos — 2011/2013/2025","Chuvas intensas e persistentes sobre encostas; precipitação concentrada por dias que satura o solo.","Relatos sobre enchentes e deslizamentos em MG."),
    ("Pará","PA","Belém","Cheias fluviais e inundações — ex.: 2012","Estação úmida com chuvas contínuas; combinação chuva + maré causa alagamentos prolongados.","Estudos sobre inundações urbanas em Belém."),
    ("Paraíba","PB","João Pessoa","Enchentes litorâneas e estiagens no sertão — 2010s","Litoral: chuvas intensas; Sertão: períodos de seca prolongada.","Relatórios sobre enchentes e estiagens na PB."),
    ("Paraná","PR","Curitiba","Enchentes/deslizamentos — março de 2011","Frentes/temporais com chuva intensa por vários dias; inundações e deslizamentos.","Defesa Civil sobre desastre de 2011 no litoral do PR."),
    ("Pernambuco","PE","Recife","Enchentes em PE/AL — junho de 2010","Precipitação intensa por vários dias; bacias transbordaram.","Relatório sobre enchentes de junho/2010."),
    ("Piauí","PI","Teresina","Seca intensa — 2012–2015","Estiagens prolongadas; quando chove, episódios concentrados geram alagamentos locais.","Monitor de Secas (Piauí)."),
    ("Rio de Janeiro","RJ","Rio de Janeiro","Deslizamentos em Petrópolis — fev 2013","Chuvas extremamente intensas e concentradas em curto período; solo saturado.","Reportagens sobre tragédia de Petrópolis 2013."),
    ("Rio Grande do Norte","RN","Natal","Alagamentos urbanos — vários anos","Pancadas fortes na estação chuvosa; drenagem vulnerável.","Relatos sobre alagamentos em Natal (RN)."),
    ("Rio Grande do Sul","RS","Porto Alegre","Enchentes — abril-maio 2024","Sistemas frontais com chuva intensa por vários dias; rios em cheia e ampla inundação.","Estudos sobre enchentes de 2024 no RS."),
    ("Rondônia","RO","Porto Velho","Cheias do Rio Madeira — 2013/2014","Chuvas acima da média na estação chuvosa; elevação rápida do rio.","Relatos sobre cheia histórica do Madeira."),
    ("Roraima","RR","Boa Vista","Cheias do Rio Branco — 2011","Chuvas intensas na bacia do Rio Branco; transbordamentos urbanos.","Relatórios sobre cheias do Rio Branco."),
    ("Santa Catarina","SC","Florianópolis","Enchentes Vale do Itajaí — nov 2008","Dias de chuva contínua e intensa; inundações e deslizamentos.","Reportagens sobre enchentes de nov/2008 em SC."),
    ("São Paulo","SP","São Paulo","Enchentes/deslizamentos Litoral Norte — fev 2023","Chuvas recorde em curtoperíodo (>600 mm/24h em alguns pontos), solo saturado.","Notícias sobre chuvas e deslizamentos de fev/2023."),
    ("Sergipe","SE","Aracaju","Estiagens no sertão e enchentes locais","Sertão: seca prolongada; litoral: pancadas intensas ocasionais.","Relatórios sobre seca e eventos em Sergipe."),
    ("Tocantins","TO","Palmas","Secas predominantes / cheias locais","Períodos secos longos seguidos da estação chuvosa intensa.","Relatórios sobre enchentes e secas no Tocantins.")
]

def create_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(SCHEMA)
    cur.executemany("INSERT INTO desastres (estado, uf, capital, evento, clima_descricao, fonte) VALUES (?, ?, ?, ?, ?, ?);", DATA)
    conn.commit()
    conn.close()
    print("Banco criado em:", DB_PATH)

if __name__ == "__main__":
    create_db()
