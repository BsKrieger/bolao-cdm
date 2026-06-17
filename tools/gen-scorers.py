#!/usr/bin/env python3
"""
gen-scorers — gera data/scorers.js a partir da API football-data.org.
Generates data/scorers.js from the football-data.org API.

Busca as 48 convocações da Copa, agrupa por país (em PT-BR) em ordem
alfabética e grava o arquivo que alimenta a lista suspensa do artilheiro.
A grafia dos jogadores vem da MESMA fonte que decide o artilheiro, então
o palpite casa com o resultado na hora de pontuar.

Uso / usage:
    # 1) defina o token (segredo — NUNCA fica no código)
    #    Windows (reabra o terminal depois):  setx FOOTBALL_DATA_TOKEN "seu_token"
    #    PowerShell (só nesta sessão):         $env:FOOTBALL_DATA_TOKEN = "seu_token"
    #    Linux/Mac:                            export FOOTBALL_DATA_TOKEN="seu_token"
    # 2) rode a partir da raiz do projeto:
    python tools/gen-scorers.py

Sem dependências externas — usa só a biblioteca padrão do Python.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

API_URL = "https://api.football-data.org/v4/competitions/WC/teams"

# Nome da seleção em inglês (como vem da API) -> português.
# EN team name (as returned by the API) -> PT-BR.
EN_TO_PT = {
    "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália",
    "Austria": "Áustria", "Belgium": "Bélgica", "Bosnia-Herzegovina": "Bósnia e Herzegovina",
    "Brazil": "Brasil", "Canada": "Canadá", "Cape Verde Islands": "Cabo Verde",
    "Colombia": "Colômbia", "Congo DR": "RD Congo", "Croatia": "Croácia",
    "Curaçao": "Curaçao", "Czechia": "Tchéquia", "Ecuador": "Equador", "Egypt": "Egito",
    "England": "Inglaterra", "France": "França", "Germany": "Alemanha", "Ghana": "Gana",
    "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque", "Ivory Coast": "Costa do Marfim",
    "Japan": "Japão", "Jordan": "Jordânia", "Mexico": "México", "Morocco": "Marrocos",
    "Netherlands": "Países Baixos", "New Zealand": "Nova Zelândia", "Norway": "Noruega",
    "Panama": "Panamá", "Paraguay": "Paraguai", "Portugal": "Portugal", "Qatar": "Catar",
    "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia", "Senegal": "Senegal",
    "South Africa": "África do Sul", "South Korea": "Coreia do Sul", "Spain": "Espanha",
    "Sweden": "Suécia", "Switzerland": "Suíça", "Tunisia": "Tunísia", "Turkey": "Turquia",
    "United States": "Estados Unidos", "Uruguay": "Uruguai", "Uzbekistan": "Uzbequistão",
}


def fetch_teams(token):
    """Busca as seleções + elencos na API. / fetch teams + squads."""
    req = urllib.request.Request(API_URL, headers={"X-Auth-Token": token})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp).get("teams", [])


def build_scorers(teams):
    """Monta [{country, players[]}] ordenado por país e por jogador."""
    out = []
    for team in teams:
        country = EN_TO_PT.get(team["name"])
        if not country:
            # Falha explícita: melhor parar do que gerar lista incompleta.
            raise SystemExit(f"Sem mapa PT-BR para a seleção: {team['name']!r}")
        players = sorted(p["name"] for p in team.get("squad", []))
        out.append({"country": country, "players": players})
    out.sort(key=lambda item: item["country"])
    return out


def write_scorers_js(scorers, dest):
    """Grava o data/scorers.js no formato que o site espera (UTF-8)."""
    header = (
        "/* Convocados da Copa 2026 — gerado por tools/gen-scorers.py\n"
        "   a partir da API football-data.org, reagrupado por país (PT-BR).\n"
        "   Para atualizar (lesão/corte), rode o script de novo. */\n"
        "const SCORERS =\n"
    )
    body = json.dumps(scorers, ensure_ascii=False, indent=2)
    footer = (
        ";\n"
        'if (typeof module !== "undefined" && module.exports) module.exports = SCORERS;\n'
    )
    dest.write_text(header + body + footer, encoding="utf-8")


def main():
    token = os.environ.get("FOOTBALL_DATA_TOKEN")
    if not token:
        sys.exit(
            "Erro: defina a variável de ambiente FOOTBALL_DATA_TOKEN "
            "com seu token da football-data.org antes de rodar."
        )

    # tools/gen-scorers.py -> raiz do projeto é a pasta de cima.
    project_root = Path(__file__).resolve().parent.parent
    dest = project_root / "data" / "scorers.js"

    teams = fetch_teams(token)
    scorers = build_scorers(teams)
    write_scorers_js(scorers, dest)

    total = sum(len(s["players"]) for s in scorers)
    print(f"OK — {len(scorers)} seleções, {total} jogadores gravados em {dest}")


if __name__ == "__main__":
    main()
