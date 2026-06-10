/* =========================================================================
   Resultados reais dos jogos / actual match results
   ---------------------------------------------------------------------------
   O organizador preenche AQUI conforme os jogos terminam. O motor de
   pontuação (scoring.js) compara os palpites com estes resultados.

   Formato por jogo:
     [id]: { home: <gols mandante>, away: <gols visitante>, advances: "home" | "away" }

   - home / away: placar final (tempo normal + prorrogação; NÃO conte pênaltis
     como gol aqui — pênaltis entram só no "advances").
   - advances: quem se classificou. Use SÓ em jogos de mata-mata (32-avos→semis).
       "home" = mandante avançou · "away" = visitante avançou.
       Vale inclusive quando a vaga foi decidida nos pênaltis.
       Em grupos, 3º lugar e final: omita o "advances".
   - Jogo ainda não realizado: não inclua o id (deixe de fora).
   ========================================================================= */
const RESULTS = {
  // Exemplos (apague quando a Copa começar):
  // 1:  { home: 2, away: 1 },                      // jogo de grupos
  // 73: { home: 1, away: 1, advances: "home" },    // mata-mata nos pênaltis
};

/* Resultado do torneio (palpites bônus) / tournament-wide result.
   Preencha no FIM da Copa:
   - champion: nome EXATO da seleção campeã (igual ao de data/teams.js, ex: "Brasil").
   - topScorer: nome do artilheiro (a comparação ignora maiúsculas/minúsculas e espaços).
*/
const TOURNAMENT_RESULT = { champion: null, topScorer: null };
