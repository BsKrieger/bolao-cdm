#!/usr/bin/env python3
"""
Tests for tools/gen-scorers.py / Testes do gerador de convocados.

EN: Pure-function tests (no network). Run from the project root with:
        python -m unittest tests.test_gen_scorers
PT-BR: Testes das funções puras (sem rede). Rode da raiz do projeto com:
        python -m unittest tests.test_gen_scorers

@author Bruno Krieger
"""
import importlib.util
import unittest
from pathlib import Path

# O arquivo tem hífen no nome (gen-scorers.py), que não é um identificador Python
# válido para `import`; carrega via importlib pelo caminho.
# The file name has a hyphen, invalid for `import`; load it by path via importlib.
_PATH = Path(__file__).resolve().parent.parent / "tools" / "gen-scorers.py"
_spec = importlib.util.spec_from_file_location("gen_scorers", _PATH)
gs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gs)


class CountryPt(unittest.TestCase):
    """Tradução do nome da seleção (ESPN -> PT-BR)."""

    def test_mapeia_nomes_comuns(self):
        self.assertEqual(gs.country_pt("Brazil"), "Brasil")
        self.assertEqual(gs.country_pt("South Korea"), "Coreia do Sul")

    def test_mapeia_as_grafias_proprias_da_espn(self):
        # A ESPN usa as grafias próprias "Cape Verde" e "Türkiye".
        self.assertEqual(gs.country_pt("Cape Verde"), "Cabo Verde")
        self.assertEqual(gs.country_pt("Türkiye"), "Turquia")

    def test_selecao_sem_mapa_para_o_script(self):
        # Falha explícita: melhor parar do que gerar lista incompleta.
        with self.assertRaises(SystemExit):
            gs.country_pt("Atlantis")


class PlayersFromRoster(unittest.TestCase):
    """Extração e ordenação dos nomes do elenco a partir do roster da ESPN."""

    def test_agrupado_por_posicao(self):
        roster = {"athletes": [
            {"position": "Goalkeeper", "items": [
                {"displayName": "B Keeper"}, {"displayName": "A Keeper"}]},
            {"position": "Forward", "items": [{"displayName": "C Striker"}]},
        ]}
        self.assertEqual(
            gs.players_from_roster(roster), ["A Keeper", "B Keeper", "C Striker"])

    def test_lista_plana(self):
        roster = {"athletes": [{"displayName": "Zico"}, {"displayName": "Ana"}]}
        self.assertEqual(gs.players_from_roster(roster), ["Ana", "Zico"])

    def test_fallback_para_fullName_e_ignora_vazios(self):
        roster = {"athletes": [
            {"fullName": "So Full"}, {"displayName": ""}, {}]}
        self.assertEqual(gs.players_from_roster(roster), ["So Full"])

    def test_roster_vazio_ou_invalido(self):
        self.assertEqual(gs.players_from_roster({}), [])
        self.assertEqual(gs.players_from_roster({"athletes": []}), [])


class BuildScorers(unittest.TestCase):
    """Monta a estrutura final ordenada por país e por jogador."""

    def test_ordena_paises_e_jogadores_e_traduz(self):
        teams = [
            {"name": "Brazil", "players": ["Vinicius", "Alisson"]},
            {"name": "Argentina", "players": ["Messi"]},
        ]
        out = gs.build_scorers(teams)
        self.assertEqual([g["country"] for g in out], ["Argentina", "Brasil"])
        self.assertEqual(out[1]["players"], ["Alisson", "Vinicius"])

    def test_propaga_falha_de_selecao_desconhecida(self):
        with self.assertRaises(SystemExit):
            gs.build_scorers([{"name": "Nowhere", "players": []}])

    def test_ordena_ignorando_acento(self):
        # "África do Sul" deve vir junto do grupo "A", não no fim por causa do "Á".
        teams = [
            {"name": "Germany", "players": []},        # Alemanha
            {"name": "South Africa", "players": []},   # África do Sul
            {"name": "Austria", "players": []},        # Áustria
        ]
        out = gs.build_scorers(teams)
        self.assertEqual(
            [g["country"] for g in out],
            ["África do Sul", "Alemanha", "Áustria"],
        )


if __name__ == "__main__":
    unittest.main()
