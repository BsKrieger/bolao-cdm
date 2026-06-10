/* =========================================================================
   Ranking geral / Overall ranking
   Busca todos os participantes + palpites no Supabase, pontua cada um com o
   motor (scoring.js + results.js) e ordena com o critério de desempate.
   ========================================================================= */
(function () {
  function init() {
    const profile = Storage.getProfile();
    if (profile) App.renderProfileChip(profile);

    const root = document.getElementById("rankingRoot");
    if (typeof DB === "undefined" || !DB.ready()) {
      root.innerHTML = `<div class="empty">
        <span class="empty__icon">🏆</span>
        <p>O ranking compartilhado precisa do backend configurado (veja docs/backend-supabase.md).</p>
      </div>`;
      return;
    }
    load(root, profile && profile.id);
  }

  async function load(root, myId) {
    root.innerHTML = `<p class="rank-loading">Carregando ranking…</p>`;
    try {
      const [data, rt] = await Promise.all([DB.fetchAll(), App.loadResults()]);
      render(root, buildRows(data, rt.res, rt.tr), myId);
    } catch (e) {
      root.innerHTML = `<div class="empty"><span class="empty__icon">⚠️</span>
        <p>Não consegui carregar o ranking.<br><small>${e.message}</small></p></div>`;
    }
  }

  function buildRows(data, results, tr) {
    const predByP = {};
    data.predictions.forEach((r) => {
      (predByP[r.participant_id] = predByP[r.participant_id] || {})[r.match_id] =
        { home: r.home, away: r.away, advances: r.advances };
    });
    const bonusByP = {};
    data.bonus.forEach((b) => {
      bonusByP[b.participant_id] = { champion: b.champion, topScorer: b.top_scorer };
    });

    return data.participants.map((p) => {
      const st = Scoring.scoreTotal(predByP[p.id] || {}, results, MATCHES);
      const bs = Scoring.scoreBonus(bonusByP[p.id] || {}, tr);
      return { id: p.id, name: p.name, total: st.total + bs.total, exact: st.exact, rights: st.rights };
    }).sort((a, b) =>
      b.total - a.total || b.exact - a.exact || b.rights - a.rights ||
      a.name.localeCompare(b.name, "pt-BR")
    );
  }

  function fmtPts(n) { return (Math.round(n * 100) / 100).toString().replace(".", ","); }

  function render(root, rows, myId) {
    if (!rows.length) {
      root.innerHTML = `<div class="empty"><span class="empty__icon">🏆</span>
        <p>Ninguém cadastrado ainda. Seja o primeiro em <a href="jogos.html">Jogos</a>!</p></div>`;
      return;
    }
    const body = rows.map((r, i) => {
      const pos = i + 1;
      const badge = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
      const me = (myId && r.id === myId) ? " rank__row--me" : "";
      return `<tr class="rank__row${me}">
        <td class="rank__pos">${badge}</td>
        <td class="rank__name">${r.name}</td>
        <td class="rank__pts">${fmtPts(r.total)}</td>
        <td class="rank__sub">${r.exact}</td>
      </tr>`;
    }).join("");
    root.innerHTML = `
      <table class="rank">
        <thead><tr><th>#</th><th>Participante</th><th>Pontos</th><th title="Placares exatos">Exatos</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="section__hint" style="margin-top:14px;">
        Desempate: mais placares exatos, depois mais resultados certos. Recarregue para atualizar.
      </p>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
