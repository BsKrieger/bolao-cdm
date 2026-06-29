#!/usr/bin/env python3
"""
gen-scorers — gera data/scorers.js a partir da API pública da ESPN.
Generates data/scorers.js from ESPN's public API.

Busca as 48 seleções da Copa e o elenco de cada uma na ESPN (GRATUITA, sem
chave), agrupa por país (PT-BR) em ordem alfabética e grava o arquivo que
alimenta a lista suspensa do artilheiro. A grafia dos jogadores vem da MESMA
fonte que decide o artilheiro (ESPN), então o palpite casa com o resultado na
hora de pontuar.

Busca as 48 World Cup squads from ESPN, groups them by country (PT-BR) and
writes the file that feeds the top-scorer dropdown. Names come from the SAME
source that decides the top scorer (ESPN), so the pick matches at scoring time.

Uso / usage:
    # rode a partir da raiz do projeto / run from the project root:
    python tools/gen-scorers.py

Sem token e sem dependências externas — usa só a biblioteca padrão do Python.
No token, no external deps — standard library only.
"""

import json
import unicodedata
import urllib.request
from pathlib import Path

# API pública da ESPN (sem chave). / ESPN public API (no key).
BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
TEAMS_URL = BASE + "/teams"
ROSTER_URL = BASE + "/teams/{id}/roster"
# A ESPN responde 403 sem um User-Agent. / ESPN returns 403 without a User-Agent.
HEADERS = {"User-Agent": "Mozilla/5.0"}

# Nome da seleção na ESPN (inglês) -> português. Mantém as duas grafias de Cabo
# Verde e Turquia que a ESPN ora usa, igual ao mapa da Edge Function.
# ESPN team name (EN) -> PT-BR; keeps both spellings ESPN may return.
EN_TO_PT = {
    "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália",
    "Austria": "Áustria", "Belgium": "Bélgica", "Bosnia-Herzegovina": "Bósnia e Herzegovina",
    "Brazil": "Brasil", "Canada": "Canadá", "Cape Verde": "Cabo Verde",
    "Cape Verde Islands": "Cabo Verde", "Colombia": "Colômbia", "Congo DR": "RD Congo",
    "Croatia": "Croácia", "Curaçao": "Curaçao", "Czechia": "Tchéquia", "Ecuador": "Equador",
    "Egypt": "Egito", "England": "Inglaterra", "France": "França", "Germany": "Alemanha",
    "Ghana": "Gana", "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque",
    "Ivory Coast": "Costa do Marfim", "Japan": "Japão", "Jordan": "Jordânia",
    "Mexico": "México", "Morocco": "Marrocos", "Netherlands": "Países Baixos",
    "New Zealand": "Nova Zelândia", "Norway": "Noruega", "Panama": "Panamá",
    "Paraguay": "Paraguai", "Portugal": "Portugal", "Qatar": "Catar",
    "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia", "Senegal": "Senegal",
    "South Africa": "África do Sul", "South Korea": "Coreia do Sul", "Spain": "Espanha",
    "Sweden": "Suécia", "Switzerland": "Suíça", "Tunisia": "Tunísia",
    "Türkiye": "Turquia", "Turkey": "Turquia", "United States": "Estados Unidos",
    "Uruguay": "Uruguai", "Uzbekistan": "Uzbequistão",
}


# ---- Funções puras (testáveis sem rede) / pure functions (no network) ----

def sort_key(s):
    """Chave de ordenação que ignora acento (para "África" cair junto de "A").

    Accent-insensitive sort key so "África" groups with the other "A" names
    instead of being pushed to the end by codepoint order.
    """
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def country_pt(espn_name):
    """Traduz o nome da ESPN; para o script se faltar (lista incompleta é pior).

    Translates the ESPN name; aborts the script when missing.
    """
    pt = EN_TO_PT.get(espn_name)
    if not pt:
        # Falha explícita: melhor parar do que gerar lista incompleta.
        raise SystemExit(f"Sem mapa PT-BR para a seleção: {espn_name!r}")
    return pt


def players_from_roster(roster):
    """Extrai e ordena os nomes do elenco no roster da ESPN.

    Aceita tanto agrupado por posição (athletes[].items[]) quanto lista plana.
    Accepts both the position-grouped and the flat athlete shapes.
    """
    athletes = roster.get("athletes", []) if isinstance(roster, dict) else []
    if athletes and isinstance(athletes[0], dict) and "items" in athletes[0]:
        athletes = [p for group in athletes for p in group.get("items", [])]
    names = [(a.get("displayName") or a.get("fullName") or "").strip() for a in athletes]
    return sorted(n for n in names if n)


def build_scorers(teams):
    """Monta [{country, players[]}] ordenado por país e por jogador.

    `teams`: iterável de {"name": <nome EN da ESPN>, "players": [<nomes>]}.
    """
    out = [
        {"country": country_pt(t["name"]), "players": sorted(t["players"], key=sort_key)}
        for t in teams
    ]
    out.sort(key=lambda item: sort_key(item["country"]))
    return out


# ---- Rede + escrita / network + writing ----

def fetch_json(url):
    """Busca e decodifica um JSON da ESPN. / fetches and decodes ESPN JSON."""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_team_list():
    """Lista as 48 seleções (id + nome inglês) no endpoint /teams da ESPN."""
    data = fetch_json(TEAMS_URL)
    leagues = data.get("sports", [{}])[0].get("leagues", [{}])[0]
    return [t["team"] for t in leagues.get("teams", [])]


def gather_squads():
    """Para cada seleção, busca o elenco e devolve [{name, players}]."""
    teams = []
    for t in fetch_team_list():
        roster = fetch_json(ROSTER_URL.format(id=t["id"]))
        teams.append({"name": t["displayName"], "players": players_from_roster(roster)})
    return teams


def write_scorers_js(scorers, dest):
    """Grava o data/scorers.js no formato que o site espera (UTF-8)."""
    header = (
        "/**\n"
        " * @file World Cup 2026 squads / Convocações da Copa 2026.\n"
        " *\n"
        " * EN: Auto-GENERATED from ESPN's public API (the same source that decides\n"
        " *     the top scorer), for the top-scorer dropdown. Do NOT edit by hand —\n"
        " *     the spelling must match the API at scoring time.\n"
        ' *     Shape: [{ country: "<PT>", players: ["<exact API name>", ...] }]\n'
        " * PT-BR: GERADO automaticamente a partir da API pública da ESPN (mesma\n"
        " *        fonte que decide o artilheiro), para a lista suspensa do\n"
        " *        artilheiro. NÃO editar à mão — a grafia precisa casar com a API.\n"
        ' *        Estrutura: [{ country: "<PT>", players: ["<nome da API>", ...] }]\n'
        " *\n"
        " * @author Bruno Krieger\n"
        " */\n"
        "const SCORERS =\n"
    )
    body = json.dumps(scorers, ensure_ascii=False, indent=2)
    footer = (
        ";\n"
        'if (typeof module !== "undefined" && module.exports) module.exports = SCORERS;\n'
    )
    dest.write_text(header + body + footer, encoding="utf-8")


def main():
    # tools/gen-scorers.py -> a raiz do projeto é a pasta de cima.
    project_root = Path(__file__).resolve().parent.parent
    dest = project_root / "data" / "scorers.js"

    scorers = build_scorers(gather_squads())
    write_scorers_js(scorers, dest)

    total = sum(len(s["players"]) for s in scorers)
    print(f"OK — {len(scorers)} seleções, {total} jogadores gravados em {dest}")


if __name__ == "__main__":
    main()
