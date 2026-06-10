/* =========================================================================
   Motor de pontuação / Scoring engine
   ---------------------------------------------------------------------------
   Regras (definidas com o organizador):
   - Placar exato ............ 10 (cheio; não soma com vencedor/saldo)
   - Resultado certo ......... 5  (vitória do lado certo OU empate)
   - Saldo (diferença) ....... +3 quando acertou o resultado E a diferença
                               de gols — vale também para empate (diferença 0)
   - Quem avança (mata-mata) . +2 (palpite separado; vale decisão por pênaltis)
   - Total do jogo ........... (pontos) × multiplicador da fase
   Funções puras: fáceis de testar (ver tests/scoring.test.js).
   ========================================================================= */
const Scoring = (() => {
  // Fases de mata-mata em que existe "quem avança" / knockout w/ advancement.
  const KO_ADVANCE = new Set(["r32", "r16", "qf", "sf"]);

  function sign(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0); }

  // Pontos do placar (sem multiplicador) / score-line points.
  function scoreLine(pred, res) {
    if (!pred || pred.home == null || pred.away == null) return 0;
    if (!res || res.home == null || res.away == null) return 0;
    const ph = pred.home, pa = pred.away, rh = res.home, ra = res.away;
    if (ph === rh && pa === ra) return 10;            // placar exato
    if (sign(ph - pa) !== sign(rh - ra)) return 0;    // errou o resultado (1/X/2)
    let pts = 5;                                       // acertou o resultado
    if ((ph - pa) === (rh - ra)) pts += 3;            // acertou a diferença (saldo)
    return pts;
  }

  // Pontos de classificação (sem multiplicador) / advancement points.
  function scoreAdvance(pred, res, phase) {
    if (!KO_ADVANCE.has(phase)) return 0;
    if (!pred || !pred.advances || !res || !res.advances) return 0;
    return pred.advances === res.advances ? 2 : 0;
  }

  // Multiplicador da fase / phase multiplier (1 se indefinido).
  function phaseMult(phase) {
    if (typeof PHASES !== "undefined" && PHASES[phase] && PHASES[phase].multiplier) {
      return PHASES[phase].multiplier;
    }
    return 1;
  }

  // Pontua um jogo (já com multiplicador) / score a single match.
  function scoreMatch(match, pred, res) {
    const multiplier = phaseMult(match.phase);
    if (!res || res.home == null || res.away == null) {
      return { line: 0, advance: 0, base: 0, multiplier, total: 0, played: false };
    }
    const line = scoreLine(pred, res);
    const advance = scoreAdvance(pred, res, match.phase);
    const base = line + advance;
    return { line, advance, base, multiplier, total: base * multiplier, played: true };
  }

  // Total do participante somando os jogos já realizados / participant total.
  function scoreTotal(predictions, results, matches) {
    let total = 0, exact = 0, rights = 0, played = 0;
    const perMatch = {};
    for (const m of matches) {
      const res = results[m.id];
      if (!res || res.home == null) continue;          // jogo não realizado
      const sc = scoreMatch(m, predictions[m.id] || null, res);
      perMatch[m.id] = sc;
      total += sc.total;
      played++;
      if (sc.line === 10) exact++;                      // placar exato
      if (sc.line >= 5) rights++;                       // resultado certo (1/X/2)
    }
    return { total, exact, rights, played, perMatch };
  }

  // ---- Palpites bônus / bonus picks ----
  const BONUS_POINTS = { champion: 20, topScorer: 15 };

  function normName(s) { return (s || "").trim().toLowerCase(); }

  function scoreBonus(bonus, tournament) {
    if (!tournament) return { champion: 0, topScorer: 0, total: 0 };
    let champion = 0, topScorer = 0;
    if (tournament.champion && bonus && bonus.champion === tournament.champion) {
      champion = BONUS_POINTS.champion;
    }
    if (tournament.topScorer && bonus && normName(bonus.topScorer) === normName(tournament.topScorer)) {
      topScorer = BONUS_POINTS.topScorer;
    }
    return { champion, topScorer, total: champion + topScorer };
  }

  return {
    sign, scoreLine, scoreAdvance, phaseMult, scoreMatch, scoreTotal,
    scoreBonus, BONUS_POINTS, KO_ADVANCE,
  };
})();

// Permite usar em Node (testes) e no navegador / works in Node and the browser.
if (typeof module !== "undefined" && module.exports) module.exports = Scoring;
