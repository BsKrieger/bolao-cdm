/* =========================================================================
   Dashboard individual / Participant dashboard
   Mostra ao participante: pontos, placares exatos, progresso e o detalhe
   por jogo (palpite × resultado × pontos). Usa o motor de pontuação.
   ========================================================================= */
(function () {
  function init() { App.requireProfile(start); }

  function start(profile) {
    App.loadResults().then(({ res, tr }) => {
      const predictions = Storage.getPredictions();
      const bonus = Storage.getBonus();
      const stats = Scoring.scoreTotal(predictions, res, MATCHES);
      const bonusScore = Scoring.scoreBonus(bonus, tr);
      renderStats(predictions, stats, bonusScore);
      renderBonus(bonus, bonusScore, tr);
      renderScored(predictions, res);
    });
  }

  // Pontos com até 2 casas, vírgula decimal / format points.
  function fmtPts(n) {
    return (Math.round(n * 100) / 100).toString().replace(".", ",");
  }

  function filledCount(predictions) {
    return MATCHES.filter((m) => {
      const p = predictions[m.id];
      return p && p.home != null && p.away != null;
    }).length;
  }

  function renderStats(predictions, stats, bonusScore) {
    const filled = filledCount(predictions);
    const pct = ((filled / MATCHES.length) * 100).toFixed(1);
    const grandTotal = stats.total + (bonusScore ? bonusScore.total : 0);
    document.getElementById("dashStats").innerHTML = `
      <div class="stats stats--dash">
        <div class="stat"><span class="stat__value">${fmtPts(grandTotal)}</span><span class="stat__label">pontos</span></div>
        <div class="stat"><span class="stat__value">${stats.exact}</span><span class="stat__label">placares exatos</span></div>
        <div class="stat"><span class="stat__value">${stats.played}</span><span class="stat__label">jogos pontuados</span></div>
        <div class="stat"><span class="stat__value">${filled}/${MATCHES.length}</span><span class="stat__label">palpites feitos</span></div>
      </div>
      <div class="progress" aria-label="Progresso dos palpites">
        <div class="progress__bar" style="width:${pct}%"></div>
      </div>
`;
  }

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

  function renderScored(predictions, res) {
    const el = document.getElementById("dashScored");
    const scored = MATCHES.filter((m) => res[m.id] && res[m.id].home != null);
    if (!scored.length) {
      el.innerHTML = `<div class="empty">
        <span class="empty__icon">⚽</span>
        <p>Ainda não há jogos com resultado. Seus pontos vão aparecer aqui conforme a Copa rola.</p>
        <a class="btn btn--primary" href="jogos.html">Ir fazer meus palpites</a>
      </div>`;
      return;
    }
    el.innerHTML = `<h2 class="section__title">Seus pontos por jogo</h2>` +
      scored.map((m) => scoredRow(m, predictions[m.id] || null, res[m.id])).join("");
  }

  function advanceLine(m, pred, res) {
    if (!Scoring.KO_ADVANCE.has(m.phase) || !res.advances) return "";
    const name = (side) => (side === "home" ? m.home : m.away);
    const mine = pred && pred.advances;
    let verdict;
    if (!mine) verdict = "(você não palpitou)";
    else if (mine === res.advances) verdict = "✓ você acertou";
    else verdict = `✗ você: ${name(mine)}`;
    return `<div class="result__adv">Avançou: <strong>${name(res.advances)}</strong> — ${verdict}</div>`;
  }

  function scoredRow(m, pred, res) {
    const sc = Scoring.scoreMatch(m, pred, res);
    const mine = pred && pred.home != null ? `${pred.home} × ${pred.away}` : "sem palpite";
    const multTxt = sc.multiplier !== 1 ? ` ×${String(sc.multiplier).replace(".", ",")}` : "";
    return `<article class="result ${sc.total > 0 ? "result--pos" : ""}">
      <div class="result__main">
        <span class="result__teams">${flagOf(m.home)} ${m.home} <b>${res.home} × ${res.away}</b> ${m.away} ${flagOf(m.away)}</span>
        <span class="result__pts">${fmtPts(sc.total)} pts</span>
      </div>
      <div class="result__sub">Seu palpite: ${mine} · placar ${sc.line} + avança ${sc.advance}${multTxt}</div>
      ${advanceLine(m, pred, res)}
    </article>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
