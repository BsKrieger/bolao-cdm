/**
 * @file Actual match results / Resultados reais dos jogos.
 *
 * EN: The organizer fills this in as games end (it's the static fallback; the
 *     live source is the Supabase `results` table). scoring.js compares the
 *     predictions against these results.
 *     Per match: [id]: { home: <home goals>, away: <away goals>, advances: "home"|"away" }
 *      - home/away: regulation-time score only (90'); do NOT count extra time
 *        or penalties as goals — they only affect "advances".
 *      - advances: who qualified. Use ONLY in knockouts (r32→sf); valid even when
 *        decided on penalties. Omit in groups, third place and final.
 *      - Match not played yet: leave the id out.
 * PT-BR: O organizador preenche AQUI conforme os jogos terminam (é o fallback
 *        estático; a fonte ao vivo é a tabela `results` do Supabase). O
 *        scoring.js compara os palpites com estes resultados.
 *        Por jogo: [id]: { home: <gols casa>, away: <gols fora>, advances: "home"|"away" }
 *         - home/away: placar SÓ do tempo regulamentar (90'); NÃO conte
 *           prorrogação nem pênaltis como gol — eles entram só no "advances".
 *         - advances: quem se classificou. Use SÓ no mata-mata (16-avos→semis);
 *           vale mesmo nos pênaltis. Omita em grupos, 3º lugar e final.
 *         - Jogo não realizado: não inclua o id.
 *
 * @author Bruno Krieger
 */
const RESULTS = {
  // Exemplos (apague quando a Copa começar):
  // 1:  { home: 2, away: 1 },                      // jogo de grupos
  // 73: { home: 1, away: 1, advances: "home" },    // 1x1 nos 90'; avançou nos pênaltis
};

/* Resultado do torneio (palpites bônus) / tournament-wide result.
   Preencha no FIM da Copa:
   - champion: nome EXATO da seleção campeã (igual ao de data/teams.js, ex: "Brasil").
   - topScorer: nome do artilheiro (a comparação ignora maiúsculas/minúsculas e espaços).
*/
const TOURNAMENT_RESULT = { champion: null, topScorer: null };
