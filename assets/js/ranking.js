/**
 * @file Overall ranking / Ranking geral.
 *
 * EN: Fetches participants + predictions from Supabase, scores them with the
 *     engine (scoring.js + results.js) and orders them with the tiebreaker.
 *     Extras:
 *      - Position change vs. the LAST computed game (green/red/dash arrow).
 *      - Click a name → chart of their position over the competition.
 *     Everything is rebuilt on the client; nothing is written to the DB.
 * PT-BR: Busca participantes + palpites no Supabase, pontua com o motor
 *        (scoring.js + results.js) e ordena com o critério de desempate. Extras:
 *      - Variação de posição vs. o ÚLTIMO jogo computado (seta verde/vermelha/–).
 *      - Clique no nome → gráfico de evolução da posição ao longo da competição.
 *        Tudo reconstruído no cliente; nada é gravado no banco (read-only).
 *
 * @author Bruno Krieger
 */
(function () {
  /**
   * Entry point: shows the profile chip, then loads the ranking (or an empty
   * state when the backend is off).
   * Ponto de entrada: mostra o chip do perfil e carrega o ranking (ou um estado
   * vazio quando o backend está off).
   *
   * @returns {void}
   */
  function init() {
    const profile = Storage.getProfile();
    if (profile) App.renderProfileChip(profile);

    const root = document.getElementById("rankingRoot");
    if (typeof DB === "undefined" || !DB.ready()) {
      root.innerHTML = `<div class="empty">
        <i class="empty__icon ti ti-trophy" aria-hidden="true"></i>
        <p>O ranking compartilhado precisa do backend configurado (veja docs/backend-supabase.md).</p>
      </div>`;
      return;
    }
    load(root, profile && profile.id);
  }

  /**
   * Fetches everything, builds the model and renders (or shows an error).
   * Busca tudo, monta o modelo e renderiza (ou mostra um erro).
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {Promise<void>}
   */
  async function load(root, myId) {
    root.innerHTML = `<p class="rank-loading">Carregando ranking…</p>`;
    try {
      const [data, rt] = await Promise.all([DB.fetchAll(), App.loadResults()]);
      render(root, buildModel(data, rt.res, rt.tr), myId);
    } catch (e) {
      root.innerHTML = `<div class="empty"><i class="empty__icon ti ti-alert-triangle" aria-hidden="true"></i>
        <p>Não consegui carregar o ranking.<br><small>${esc(e.message)}</small></p></div>`;
    }
  }

  // ---- Helpers ---- (esc e fmtPts são globais, definidos em app.js)

  /**
   * Position badge: an icon for the podium, the number for the rest.
   * Selo da posição: ícone para o pódio, número para o resto.
   *
   * @param {number} pos - 1-based position / Posição (base 1).
   * @returns {string|number} Icon HTML or the number / HTML do ícone ou o número.
   */
  function medal(pos) {
    if (pos === 1) return '<i class="ti ti-trophy rank__medal rank__medal--gold" aria-hidden="true"></i>';
    if (pos === 2) return '<i class="ti ti-medal rank__medal rank__medal--silver" aria-hidden="true"></i>';
    if (pos === 3) return '<i class="ti ti-medal rank__medal rank__medal--bronze" aria-hidden="true"></i>';
    return pos;
  }

  /**
   * Change cell: ▲ green (up), ▼ red (down), – white (no change / no data).
   * Célula de variação: ▲ verde (subiu), ▼ vermelho (caiu), – branco (igual).
   *
   * @param {?number} delta - Positions gained (+) or lost (−) / Posições ganhas/perdidas.
   * @returns {string} <td> HTML / HTML da <td>.
   */
  function moveCell(delta) {
    if (delta == null) return `<td class="rank__delta"></td>`;
    if (delta > 0) {
      return `<td class="rank__delta"><span class="rank__move rank__move--up">` +
        `<i class="ti ti-arrow-up" aria-hidden="true"></i>${delta}</span></td>`;
    }
    if (delta < 0) {
      return `<td class="rank__delta"><span class="rank__move rank__move--down">` +
        `<i class="ti ti-arrow-down" aria-hidden="true"></i>${-delta}</span></td>`;
    }
    return `<td class="rank__delta"><span class="rank__move rank__move--same">–</span></td>`;
  }

  // ---- Modelo: ranking atual + histórico de posições + variação ----

  /**
   * Builds per-participant indexes (predictions by match, bonus picks).
   * Monta índices por participante (palpites por jogo, palpites bônus).
   *
   * @param {{predictions:Array, bonus:Array}} data - Raw rows / Linhas cruas.
   * @returns {{predByP:Object, bonusByP:Object}}
   */
  function indexData(data) {
    const predByP = {};
    data.predictions.forEach((r) => {
      (predByP[r.participant_id] = predByP[r.participant_id] || {})[r.match_id] =
        { home: r.home, away: r.away, advances: r.advances };
    });
    const bonusByP = {};
    data.bonus.forEach((b) => {
      bonusByP[b.participant_id] = { champion: b.champion, topScorer: b.top_scorer };
    });
    return { predByP, bonusByP };
  }

  /**
   * Games already computed (have a result), in chronological order.
   * Jogos já computados (têm resultado), em ordem cronológica.
   *
   * @param {Object<number, Object>} results - Results by id / Resultados por id.
   * @returns {Array<Object>}
   */
  function computedGames(results) {
    return MATCHES
      .filter((m) => results[m.id] && results[m.id].home != null)
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  }

  /**
   * Subset of results covering only the first k games (for snapshots).
   * Subconjunto de resultados só dos k primeiros jogos (para os snapshots).
   *
   * @param {Array<Object>} games - Computed games / Jogos computados.
   * @param {number} k - How many games to include / Quantos jogos incluir.
   * @param {Object<number, Object>} results - Results by id / Resultados por id.
   * @returns {Object<number, Object>}
   */
  function resultsThrough(games, k, results) {
    const sub = {};
    for (let i = 0; i < k; i++) sub[games[i].id] = results[games[i].id];
    return sub;
  }

  /**
   * Ordered ranking from a given set of results. withBonus applies the bonus
   * (only in the final state, when it is revealed). Tiebreaker: total → exact
   * scores → right results → name.
   * Ranking ordenado a partir de um conjunto de resultados. withBonus aplica o
   * bônus (só no estado final). Desempate: total → exatos → acertos → nome.
   *
   * @param {Array<{id:*, name:string}>} participants - Participants / Participantes.
   * @param {{predByP:Object, bonusByP:Object}} idx - Indexes / Índices.
   * @param {Object<number, Object>} results - Results subset / Subconjunto de resultados.
   * @param {?Object} tr - Tournament outcome / Resultado do torneio.
   * @param {boolean} withBonus - Apply bonus? / Aplicar o bônus?
   * @returns {Array<{id:*, name:string, total:number, exact:number, rights:number}>}
   */
  function rankSnapshot(participants, idx, results, tr, withBonus) {
    return participants.map((p) => {
      const st = Scoring.scoreTotal(idx.predByP[p.id] || {}, results, MATCHES);
      const bs = withBonus ? Scoring.scoreBonus(idx.bonusByP[p.id] || {}, tr) : { total: 0 };
      return { id: p.id, name: p.name, total: st.total + bs.total, exact: st.exact, rights: st.rights };
    }).sort((a, b) =>
      b.total - a.total || b.exact - a.exact || b.rights - a.rights ||
      a.name.localeCompare(b.name, "pt-BR")
    );
  }

  /**
   * Maps id → position (1..N) from an ordered ranking.
   * Mapeia id → posição (1..N) a partir de um ranking ordenado.
   *
   * @param {Array<{id:*}>} rankedRows - Ordered rows / Linhas ordenadas.
   * @returns {Object<*, number>}
   */
  function positionMap(rankedRows) {
    const m = {};
    rankedRows.forEach((r, i) => { m[r.id] = i + 1; });
    return m;
  }

  /**
   * Builds the full ranking model: current rows, position history per
   * participant, and the delta since the previous computed game.
   * Monta o modelo completo do ranking: linhas atuais, histórico de posição por
   * participante e a variação desde o jogo computado anterior.
   *
   * @param {{participants:Array, predictions:Array, bonus:Array}} data - Raw data / Dados crus.
   * @param {Object<number, Object>} results - Results by id / Resultados por id.
   * @param {?Object} tr - Tournament outcome / Resultado do torneio.
   * @returns {{rows:Array, historyById:Object, deltaById:Object, games:Array, total:number, nameById:Object}}
   */
  function buildModel(data, results, tr) {
    const idx = indexData(data);
    const games = computedGames(results);
    const N = games.length;
    const nameById = {};
    data.participants.forEach((p) => { nameById[p.id] = p.name; });

    // snapshots[k] = posição por id após k jogos (k = 0..N). Bônus só em k===N.
    const snapshots = [];
    let currentRows = [];
    for (let k = 0; k <= N; k++) {
      const ranked = rankSnapshot(data.participants, idx, resultsThrough(games, k, results), tr, k === N);
      if (k === N) currentRows = ranked;
      snapshots.push(positionMap(ranked));
    }

    // Série de posições (k=1..N) e variação desde o último jogo / history + delta.
    const historyById = {};
    const deltaById = {};
    data.participants.forEach((p) => {
      const series = [];
      for (let k = 1; k <= N; k++) series.push(snapshots[k][p.id]);
      historyById[p.id] = series;
      deltaById[p.id] = N >= 1 ? (snapshots[N - 1][p.id] - snapshots[N][p.id]) : null;
    });

    return {
      rows: currentRows, historyById, deltaById, games,
      total: data.participants.length, nameById,
      predByP: idx.predByP, results, // p/ a lista de palpites por jogo / for the per-game picks list
    };
  }

  // ---- Evolution chart (inline SVG, no deps) / gráfico de evolução ----

  /**
   * Builds the inline SVG line chart of a participant's positions over time.
   * Monta o gráfico SVG (linha) das posições de um participante ao longo do tempo.
   *
   * @param {Array<number>} series - Positions per computed game / Posições por jogo.
   * @param {number} totalPlayers - Field size (for the Y scale) / Total de jogadores.
   * @param {Array<Object>} games - Computed games (for X labels) / Jogos (rótulos do X).
   * @returns {string} SVG markup / Marcação SVG.
   */
  function buildChartSVG(series, totalPlayers, games) {
    const N = series.length;
    const W = 640, H = 200, L = 38, R = 14, T = 16, B = 30;
    const plotW = W - L - R, plotH = H - T - B;
    const P = Math.max(totalPlayers, 1);
    const xFor = (i) => N > 1 ? L + (i / (N - 1)) * plotW : L + plotW / 2;
    const yFor = (pos) => P > 1 ? T + ((pos - 1) / (P - 1)) * plotH : T + plotH / 2;

    // Linhas-guia: 1º (topo), meio e Pº (base) / gridlines top/mid/bottom.
    const grid = uniq([1, Math.ceil(P / 2), P]).map((pos) => {
      const y = yFor(pos).toFixed(1);
      return `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" class="rchart__grid"/>` +
        `<text x="${L - 6}" y="${(+y + 4).toFixed(1)}" class="rchart__ylabel">${pos}º</text>`;
    }).join("");

    const pts = series.map((pos, i) => `${xFor(i).toFixed(1)},${yFor(pos).toFixed(1)}`).join(" ");
    const line = N > 1 ? `<polyline points="${pts}" class="rchart__line"/>` : "";
    const dots = series.map((pos, i) =>
      `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(pos).toFixed(1)}" r="${(i === 0 || i === N - 1) ? 3.6 : 2}" class="rchart__dot"/>`
    ).join("");

    const dlabel = (g) => new Intl.DateTimeFormat("pt-BR",
      { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(g.kickoff));
    let xlabels = `<text x="${L}" y="${H - 9}" class="rchart__xlabel" text-anchor="start">${dlabel(games[0])}</text>`;
    if (N > 1) xlabels += `<text x="${W - R}" y="${H - 9}" class="rchart__xlabel" text-anchor="end">${dlabel(games[N - 1])}</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" class="rchart__svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolução da posição">${grid}${line}${dots}${xlabels}</svg>`;
  }

  /**
   * Removes duplicate values, preserving order.
   * Remove valores duplicados, preservando a ordem.
   *
   * @param {Array} arr
   * @returns {Array}
   */
  function uniq(arr) { return arr.filter((v, i, a) => a.indexOf(v) === i); }

  /**
   * Builds the expandable chart sub-row (tr) for a participant.
   * Monta a sub-linha (tr) expansível com o gráfico de um participante.
   *
   * @param {string} id - Participant id (as string) / Id do participante (string).
   * @param {Object} model - The ranking model / O modelo do ranking.
   * @returns {string} <tr> HTML / HTML da <tr>.
   */
  function chartRow(id, model) {
    const series = model.historyById[id] || [];
    const name = esc(model.nameById[id] || "—");
    if (!series.length) {
      return `<tr class="rank__chartrow" data-for="${esc(String(id))}"><td colspan="5">
        <div class="rank__chart"><p class="rank__chart-empty">Ainda não há jogos computados para mostrar a evolução de ${name}.</p></div></td></tr>`;
    }
    const start = series[0], now = series[series.length - 1];
    const best = Math.min.apply(null, series), worst = Math.max.apply(null, series);
    return `<tr class="rank__chartrow" data-for="${esc(String(id))}"><td colspan="5">
      <div class="rank__expand">
        <div class="rank__chart">
          <h3 class="rank__chart-title">Evolução de ${name}</h3>
          ${buildChartSVG(series, model.total, model.games)}
          <p class="rank__chart-cap">Começou em <strong>${start}º</strong> · agora <strong>${now}º</strong> · melhor <strong>${best}º</strong> · pior <strong>${worst}º</strong></p>
        </div>
        ${lastPicksPanel(id, model)}
      </div></td></tr>`;
  }

  /**
   * Side panel next to the chart: the player's picks on finished games, newest
   * first, each with the real score, the prediction and the points.
   * Painel ao lado do gráfico: os palpites do jogador nos jogos já finalizados,
   * do mais recente para o mais antigo, com o placar real, o palpite e os pontos.
   *
   * @param {*} id - Participant id / Id do participante.
   * @param {Object} model - The ranking model / O modelo do ranking.
   * @returns {string} Panel HTML / HTML do painel.
   */
  function lastPicksPanel(id, model) {
    const preds = (model.predByP && model.predByP[id]) || {};
    const res = model.results || {};
    const games = model.games.slice().reverse(); // mais recente primeiro / newest first
    if (!games.length) return "";
    const items = games.map((m) => {
      const r = res[m.id];
      const pred = preds[m.id] || null;
      const sc = Scoring.scoreMatch(m, pred, r);
      const mine = (pred && pred.home != null) ? `${pred.home} × ${pred.away}` : "—";
      const cls = sc.total > 0 ? (Scoring.isMax(m, sc) ? " rank__pick--max" : " rank__pick--pos") : " rank__pick--zero";
      return `<div class="rank__pick${cls}">
        <span class="rank__pick-game">${flagOf(m.home)}<b>${r.home} × ${r.away}</b>${flagOf(m.away)}</span>
        <span class="rank__pick-mine">${esc(mine)}</span>
        <span class="rank__pick-pts">${fmtPts(sc.total)} pts</span>
      </div>`;
    }).join("");
    return `<div class="rank__lastpicks">
      <h3 class="rank__chart-title">Palpites nos jogos finalizados</h3>
      <div class="rank__picks-list">
        <div class="rank__pick rank__pick--head">
          <span class="rank__pick-game">Placar</span>
          <span class="rank__pick-mine">Palpite</span>
          <span class="rank__pick-pts"></span>
        </div>
        ${items}
      </div>
    </div>`;
  }

  // ---- Render ----

  /**
   * Builds one ranking table row (medal, change, name button, points, exacts).
   * Monta uma linha da tabela de ranking (medalha, variação, botão do nome,
   * pontos, exatos).
   *
   * @param {{id:*, name:string, total:number, exact:number}} r - Row data / Dados da linha.
   * @param {number} i - 0-based index / Índice (base 0).
   * @param {Object} model - The ranking model / O modelo do ranking.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {string} <tr> HTML / HTML da <tr>.
   */
  function rowHtml(r, i, model, myId) {
    const pos = i + 1;
    const podium = pos === 1 ? " rank__row--gold" : pos === 2 ? " rank__row--silver" : pos === 3 ? " rank__row--bronze" : "";
    const me = (myId && r.id === myId) ? " rank__row--me" : "";
    return `<tr class="rank__row${podium}${me}">
      <td class="rank__pos">${medal(pos)}</td>
      ${moveCell(model.deltaById[r.id])}
      <td class="rank__name"><button type="button" class="rank__namebtn" data-id="${esc(String(r.id))}" aria-expanded="false">${esc(r.name)}<i class="ti ti-chevron-down rank__namechev" aria-hidden="true"></i></button></td>
      <td class="rank__pts">${fmtPts(r.total)}</td>
      <td class="rank__sub">${r.exact}</td>
    </tr>`;
  }

  /**
   * Renders the ranking table (or the empty state) and wires the name toggle.
   * Renderiza a tabela do ranking (ou o estado vazio) e liga o toggle do nome.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {Object} model - The ranking model / O modelo do ranking.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {void}
   */
  function render(root, model, myId) {
    if (!model.rows.length) {
      root.innerHTML = `<div class="empty"><i class="empty__icon ti ti-trophy" aria-hidden="true"></i>
        <p>Ninguém cadastrado ainda. Seja o primeiro em <a href="jogos.html">Jogos</a>!</p></div>`;
      return;
    }
    const body = model.rows.map((r, i) => rowHtml(r, i, model, myId)).join("");
    root.innerHTML = `
      <table class="rank">
        <thead><tr>
          <th>#</th>
          <th title="Variação desde o último jogo">Var.</th>
          <th>Participante</th>
          <th>Pontos</th>
          <th title="Placares exatos">Exatos</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="section__hint" style="margin-top:14px;">
        Setas = variação desde o último jogo computado. Clique na linha para ver a evolução. Recarregue para atualizar.
      </p>`;
    attachRowToggle(root, model);
  }

  /**
   * Clicking a name opens/closes its chart (one at a time), via event
   * delegation on the table.
   * Clicar num nome abre/fecha o gráfico dele (um por vez), via delegação de
   * evento na tabela.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {Object} model - The ranking model / O modelo do ranking.
   * @returns {void}
   */
  function attachRowToggle(root, model) {
    const table = root.querySelector(".rank");
    if (!table) return;
    table.addEventListener("click", (e) => {
      const row = e.target.closest("tr.rank__row"); // qualquer lugar da linha do participante
      if (!row) return;                             // ignora o cabeçalho e a linha do gráfico
      const btn = row.querySelector(".rank__namebtn");
      if (!btn) return;
      const id = btn.dataset.id;
      const next = row.nextElementSibling;
      const wasOpen = next && next.classList.contains("rank__chartrow") && next.dataset.for === id;

      // Fecha qualquer gráfico aberto / close any open chart first.
      root.querySelectorAll(".rank__chartrow").forEach((r) => r.remove());
      root.querySelectorAll('.rank__namebtn[aria-expanded="true"]')
        .forEach((b) => b.setAttribute("aria-expanded", "false"));

      if (wasOpen) return; // clicou no que já estava aberto: só fecha
      row.insertAdjacentHTML("afterend", chartRow(id, model));
      btn.setAttribute("aria-expanded", "true");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
