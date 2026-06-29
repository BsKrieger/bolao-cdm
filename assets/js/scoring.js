/**
 * @file Scoring engine / Motor de pontuação.
 *
 * EN: Pure, testable functions (see tests/scoring.test.js). Rules agreed with
 *     the organizer:
 *  - Exact score ......... 10 (full; does not stack with winner/goal diff)
 *  - Right result ........ 5  (correct winner OR a draw)
 *  - Goal difference ..... +3 when the result is right AND the diff matches
 *                          (also valid for a draw, diff 0)
 *  - Who advances (KO) ... +2 (separate pick; counts decisions on penalties)
 *  - Match total ......... (points) × phase multiplier
 *
 * PT-BR: Funções puras e testáveis (ver tests/scoring.test.js). Regras
 *        definidas com o organizador:
 *  - Placar exato ........ 10 (cheio; não soma com vencedor/saldo)
 *  - Resultado certo ..... 5  (vitória do lado certo OU empate)
 *  - Saldo (diferença) ... +3 quando acertou o resultado E a diferença
 *  - Quem avança (KO) .... +2 (palpite separado; vale decisão por pênaltis)
 *  - Total do jogo ....... (pontos) × multiplicador da fase
 *
 * @author Bruno Krieger
 */
const Scoring = (() => {
  /** Knockout phases that have a "who advances" pick / fases com "quem avança". */
  const KO_ADVANCE = new Set(["r32", "r16", "qf", "sf"]);

  /**
   * Sign of a number: 1, -1 or 0.
   * Sinal de um número: 1, -1 ou 0.
   *
   * @param {number} n
   * @returns {-1|0|1}
   */
  function sign(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0); }

  /**
   * Score-line points (no multiplier).
   * Pontos do placar (sem multiplicador).
   *
   * @param {?{home:number, away:number}} pred - The prediction / O palpite.
   * @param {?{home:number, away:number}} res - The actual result / O resultado.
   * @returns {number} 10, 8, 5 or 0 / 10, 8, 5 ou 0.
   */
  function scoreLine(pred, res) {
    if (!pred || pred.home == null || pred.away == null) return 0;
    if (!res || res.home == null || res.away == null) return 0;
    const ph = pred.home, pa = pred.away, rh = res.home, ra = res.away;
    if (ph === rh && pa === ra) return 10;            // placar exato / exact score
    if (sign(ph - pa) !== sign(rh - ra)) return 0;    // errou o resultado (1/X/2)
    let pts = 5;                                       // acertou o resultado / right result
    if ((ph - pa) === (rh - ra)) pts += 3;            // acertou a diferença / right diff
    return pts;
  }

  /**
   * Effective "who advances" from a prediction: the score-line winner when there
   * is one; otherwise the manual pick (only meaningful on a draw, which goes to
   * extra time/penalties). Single source of truth for the UI and the scoring, so
   * a winner in the score never disagrees with the advancing side.
   * "Quem avança" efetivo de um palpite: o vencedor do placar quando há um; senão,
   * a escolha manual (só faz sentido no empate, que vai p/ prorrogação/pênaltis).
   * Fonte única para a tela e a pontuação, então um vencedor no placar nunca
   * diverge de quem avança.
   *
   * @param {?{home:number, away:number, advances?:string}} pred - The prediction / O palpite.
   * @returns {?("home"|"away")}
   */
  function effectiveAdvance(pred) {
    if (!pred) return null;
    if (pred.home != null && pred.away != null) {
      if (pred.home > pred.away) return "home";
      if (pred.away > pred.home) return "away";
    }
    return pred.advances || null; // empate (ou sem placar): vale a escolha manual
  }

  /**
   * Advancement points (no multiplier); only on knockout phases. Uses the
   * effective advance (derived from the score when there's a winner).
   * Pontos de classificação (sem multiplicador); só no mata-mata. Usa o avanço
   * efetivo (derivado do placar quando há vencedor).
   *
   * @param {?{home:number, away:number, advances?:string}} pred - The prediction / O palpite.
   * @param {?{advances?: string}} res - The actual result / O resultado.
   * @param {string} phase - Match phase / Fase do jogo.
   * @returns {0|2}
   */
  function scoreAdvance(pred, res, phase) {
    if (!KO_ADVANCE.has(phase)) return 0;
    const pa = effectiveAdvance(pred);
    if (!pa || !res || !res.advances) return 0;
    return pa === res.advances ? 2 : 0;
  }

  /**
   * Phase multiplier (1 when undefined).
   * Multiplicador da fase (1 se indefinido).
   *
   * @param {string} phase - Match phase / Fase do jogo.
   * @returns {number}
   */
  function phaseMult(phase) {
    if (typeof PHASES !== "undefined" && PHASES[phase] && PHASES[phase].multiplier) {
      return PHASES[phase].multiplier;
    }
    return 1;
  }

  /**
   * Scores a single match (multiplier already applied).
   * Pontua um jogo (já com multiplicador aplicado).
   *
   * @param {{phase:string}} match - The match / O jogo.
   * @param {?Object} pred - The prediction / O palpite.
   * @param {?{home:number, away:number, advances?:string}} res - The result / O resultado.
   * @returns {{line:number, advance:number, base:number, multiplier:number, total:number, played:boolean}}
   */
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

  /**
   * Did this prediction hit the match's MAXIMUM score? Exact score (10) and, on
   * knockouts, the right advancement (2). Compares by base to dodge float error.
   * É a pontuação MÁXIMA possível do jogo? Placar exato (10) e, no mata-mata,
   * também o avanço certo (2). Compara pela base p/ evitar erro de float.
   *
   * @param {{phase:string}} match - The match / O jogo.
   * @param {{line:number, advance:number}} sc - A scoreMatch() result / Resultado de scoreMatch().
   * @returns {boolean}
   */
  function isMax(match, sc) {
    if (!sc || sc.line !== 10) return false;
    return KO_ADVANCE.has(match.phase) ? sc.advance === 2 : true;
  }

  /**
   * Participant total over the matches already played.
   * Total do participante somando os jogos já realizados.
   *
   * @param {Object<number, Object>} predictions - Predictions by match id / Palpites por id.
   * @param {Object<number, Object>} results - Results by match id / Resultados por id.
   * @param {Array<Object>} matches - All matches / Todos os jogos.
   * @returns {{total:number, exact:number, rights:number, played:number, perMatch:Object}}
   */
  function scoreTotal(predictions, results, matches) {
    let total = 0, exact = 0, rights = 0, played = 0;
    const perMatch = {};
    for (const m of matches) {
      const res = results[m.id];
      if (!res || res.home == null) continue;          // jogo não realizado / not played
      const sc = scoreMatch(m, predictions[m.id] || null, res);
      perMatch[m.id] = sc;
      total += sc.total;
      played++;
      if (sc.line === 10) exact++;                      // placar exato / exact score
      if (sc.line >= 5) rights++;                       // resultado certo (1/X/2)
    }
    return { total, exact, rights, played, perMatch };
  }

  // ---- Bonus picks / palpites bônus ----

  /** Points awarded by each bonus pick / pontos de cada palpite bônus. */
  const BONUS_POINTS = { champion: 20, topScorer: 15 };

  /**
   * Normalizes a name for comparison: trim + lowercase + strip accents. Accent-
   * insensitive so a pick saved with one spelling still matches the result from
   * another source (e.g. "Mbappe" vs "Mbappé").
   * Normaliza um nome para comparação: trim + minúsculas + remove acentos. Sem
   * sensibilidade a acento, um palpite salvo com uma grafia ainda casa com o
   * resultado vindo de outra fonte (ex.: "Mbappe" vs "Mbappé").
   *
   * @param {?string} s
   * @returns {string}
   */
  function normName(s) {
    return (s || "").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, ""); // remove acentos
  }

  /**
   * Scores the bonus picks against the tournament outcome.
   * Pontua os palpites bônus contra o resultado final do torneio.
   *
   * @param {?{champion?:string, topScorer?:string}} bonus - The picks / Os palpites.
   * @param {?{champion?:string, topScorer?:string}} tournament - The outcome / O resultado.
   * @returns {{champion:number, topScorer:number, total:number}}
   */
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
    sign, scoreLine, effectiveAdvance, scoreAdvance, phaseMult, scoreMatch, isMax,
    scoreTotal, scoreBonus, BONUS_POINTS, KO_ADVANCE,
  };
})();

// Works in Node (tests) and in the browser / permite usar em Node e no navegador.
if (typeof module !== "undefined" && module.exports) module.exports = Scoring;
