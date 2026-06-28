/**
 * @file Participant dashboard / Dashboard individual.
 *
 * EN: Shows the participant their points, exact scores, progress and the
 *     per-match detail (prediction × result × points). Uses the scoring engine.
 * PT-BR: Mostra ao participante: pontos, placares exatos, progresso e o detalhe
 *        por jogo (palpite × resultado × pontos). Usa o motor de pontuação.
 *
 * @author Bruno Krieger
 */
(function () {
  /**
   * Entry point: requires a profile, then starts.
   * Ponto de entrada: exige um perfil e então inicia.
   *
   * @returns {void}
   */
  function init() { App.requireProfile(start); }

  /**
   * Loads results and renders the three dashboard sections.
   * Carrega os resultados e renderiza as três seções do dashboard.
   *
   * @param {Object} profile - The current profile / O perfil atual.
   * @returns {void}
   */
  function start(profile) {
    // Hidrata os times reais do mata-mata em paralelo com os resultados.
    Promise.all([App.loadResults(), KoTeams.hydrate(MATCHES)]).then(([{ res, tr }]) => {
      const predictions = Storage.getPredictions();
      const bonus = Storage.getBonus();
      const stats = Scoring.scoreTotal(predictions, res, MATCHES);
      const bonusScore = Scoring.scoreBonus(bonus, tr);
      renderStats(predictions, stats, bonusScore);
      renderBonus(bonus, bonusScore, tr);
      renderScored(predictions, res);
    });
  }

  /**
   * Counts how many matches have a complete score prediction.
   * Conta quantos jogos têm um palpite de placar completo.
   *
   * @param {Object<number, Object>} predictions - Predictions by id / Palpites por id.
   * @returns {number}
   */
  function filledCount(predictions) {
    return MATCHES.filter((m) => {
      const p = predictions[m.id];
      return p && p.home != null && p.away != null;
    }).length;
  }

  /**
   * Renders the top stat cards (points, exact scores, scored/finished, filled)
   * plus the progress bar.
   * Renderiza os cards de estatística do topo (pontos, exatos, pontuados/
   * finalizados, palpites feitos) e a barra de progresso.
   *
   * @param {Object<number, Object>} predictions - Predictions by id / Palpites por id.
   * @param {Object} stats - scoreTotal() result / Resultado de scoreTotal().
   * @param {Object} bonusScore - scoreBonus() result / Resultado de scoreBonus().
   * @returns {void}
   */
  function renderStats(predictions, stats, bonusScore) {
    const filled = filledCount(predictions);
    const pct = ((filled / MATCHES.length) * 100).toFixed(1);
    const grandTotal = stats.total + (bonusScore ? bonusScore.total : 0);
    // pontuados = jogos em que somou algum ponto; finalizados = jogos com resultado.
    const scoredCount = Object.values(stats.perMatch).filter((sc) => sc.total > 0).length;
    const finishedCount = stats.played;
    document.getElementById("dashStats").innerHTML = `
      <div class="stats stats--dash">
        <div class="stat"><span class="stat__value">${fmtPts(grandTotal)}</span><span class="stat__label">pontos</span></div>
        <div class="stat"><span class="stat__value">${stats.exact}</span><span class="stat__label">placares exatos</span></div>
        <div class="stat"><span class="stat__value">${scoredCount}/${finishedCount}</span><span class="stat__label">pontuados / finalizados</span></div>
        <div class="stat"><span class="stat__value">${filled}/${MATCHES.length}</span><span class="stat__label">palpites feitos</span></div>
      </div>
      <div class="progress" aria-label="Progresso dos palpites">
        <div class="progress__bar" style="width:${pct}%"></div>
      </div>
`;
  }

  /**
   * Renders the bonus cards (champion + top scorer), showing the earned points
   * only once the tournament outcome is known.
   * Renderiza os cards de bônus (campeão + artilheiro), mostrando os pontos só
   * quando o resultado do torneio é conhecido.
   *
   * @param {Object} bonus - The bonus picks / Os palpites bônus.
   * @param {Object} bonusScore - scoreBonus() result / Resultado de scoreBonus().
   * @param {?Object} tr - Tournament outcome / Resultado do torneio.
   * @returns {void}
   */
  function renderBonus(bonus, bonusScore, tr) {
    const el = document.getElementById("dashBonus");
    if (!el) return;
    const resolved = tr && (tr.champion || tr.topScorer);
    const champ = bonus.champion ? `${flagOf(bonus.champion)} ${bonus.champion}` : `<span class="muted">não palpitado</span>`;
    const top = bonus.topScorer ? bonus.topScorer : `<span class="muted">não palpitado</span>`;
    const champPts = resolved ? ` <em>(${bonusScore.champion} pts)</em>` : "";
    const topPts = resolved ? ` <em>(${bonusScore.topScorer} pts)</em>` : "";
    el.innerHTML = `
      <h2 class="section__title">Palpites bônus</h2>
      <div class="bonus-cards">
        <div class="bonus-card">
          <span class="bonus-card__label">Seleção campeã</span>
          <span class="bonus-card__value">${champ}${champPts}</span>
        </div>
        <div class="bonus-card">
          <span class="bonus-card__label">Artilheiro</span>
          <span class="bonus-card__value">${top}${topPts}</span>
        </div>
      </div>
      ${resolved ? "" : `<p class="dash__note">Valem no fim da Copa: campeã ${Scoring.BONUS_POINTS.champion} pts · artilheiro ${Scoring.BONUS_POINTS.topScorer} pts. Edite em <a href="jogos.html">Jogos</a>.</p>`}`;
  }

  /**
   * Renders the per-match points list, most recent finished game first.
   * Renderiza a lista de pontos por jogo, do mais recente finalizado primeiro.
   *
   * @param {Object<number, Object>} predictions - Predictions by id / Palpites por id.
   * @param {Object<number, Object>} res - Results by id / Resultados por id.
   * @returns {void}
   */
  function renderScored(predictions, res) {
    const el = document.getElementById("dashScored");
    // Ordem inversa: último jogo computado primeiro, 1º da Copa por último.
    // Reverse order: most recent computed game first, opener last.
    const scored = MATCHES
      .filter((m) => res[m.id] && res[m.id].home != null)
      .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
    if (!scored.length) {
      el.innerHTML = `<div class="empty">
        <i class="empty__icon ti ti-ball-football" aria-hidden="true"></i>
        <p>Ainda não há jogos com resultado. Seus pontos vão aparecer aqui conforme a Copa rola.</p>
        <a class="btn btn--primary" href="jogos.html">Ir fazer meus palpites</a>
      </div>`;
      return;
    }
    el.innerHTML = `<h2 class="section__title">Seus pontos por jogo</h2>` +
      scored.map((m) => scoredRow(m, predictions[m.id] || null, res[m.id])).join("");
  }

  /**
   * Builds the "who advanced" line for a knockout match (with the verdict).
   * Monta a linha de "quem avançou" para um jogo de mata-mata (com o veredito).
   *
   * @param {Object} m - The match / O jogo.
   * @param {?Object} pred - The prediction / O palpite.
   * @param {Object} res - The result / O resultado.
   * @returns {string} HTML (or "" outside knockouts) / HTML (ou "" fora do mata-mata).
   */
  function advanceLine(m, pred, res) {
    if (!Scoring.KO_ADVANCE.has(m.phase) || !res.advances) return "";
    const name = (side) => (side === "home" ? m.home : m.away);
    const mine = Scoring.effectiveAdvance(pred);
    let verdict;
    if (!mine) verdict = "(você não palpitou)";
    else if (mine === res.advances) verdict = '<i class="ti ti-circle-check result__ok" aria-hidden="true"></i> você acertou';
    else verdict = `<i class="ti ti-circle-x result__bad" aria-hidden="true"></i> você: ${name(mine)}`;
    return `<div class="result__adv">Avançou: <strong>${name(res.advances)}</strong> — ${verdict}</div>`;
  }

  /**
   * Builds one match result card (teams, official score, your pick, points, and
   * a "máxima" badge when the maximum score was hit).
   * Monta um card de resultado (times, placar oficial, seu palpite, pontos e um
   * selo "máxima" quando a pontuação máxima foi atingida).
   *
   * @param {Object} m - The match / O jogo.
   * @param {?Object} pred - The prediction / O palpite.
   * @param {Object} res - The result / O resultado.
   * @returns {string} Card HTML / HTML do card.
   */
  function scoredRow(m, pred, res) {
    const sc = Scoring.scoreMatch(m, pred, res);
    const mine = pred && pred.home != null ? `${pred.home} × ${pred.away}` : "sem palpite";
    const multTxt = sc.multiplier !== 1 ? ` ×${String(sc.multiplier).replace(".", ",")}` : "";
    const isMax = Scoring.isMax(m, sc);
    const cls = "result" + (sc.total > 0 ? " result--pos" : "") + (isMax ? " result--max" : "");
    const badge = isMax
      ? ` <span class="result__max-tag"><i class="ti ti-star-filled" aria-hidden="true"></i> máxima</span>` : "";
    return `<article class="${cls}">
      <div class="result__main">
        <span class="result__teams">${flagOf(m.home)} ${m.home} <b>${res.home} × ${res.away}</b> ${m.away} ${flagOf(m.away)}</span>
        <span class="result__pts">${fmtPts(sc.total)} pts</span>
      </div>
      <div class="result__sub">Seu palpite: ${mine} · placar ${sc.line} + avança ${sc.advance}${multTxt}${badge}</div>
      ${advanceLine(m, pred, res)}
    </article>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
