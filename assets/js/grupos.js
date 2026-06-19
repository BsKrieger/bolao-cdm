/**
 * @file Groups & bracket / Grupos e Chaveamento.
 *
 * EN: Mirrors the REAL tournament (not the bolão): group tables and the knockout
 *     bracket, read straight from ESPN's public API (no backend). Standings come
 *     from the standings endpoint (rank/points already computed); the bracket
 *     from the knockout scoreboard, bucketed by round. Team names are translated
 *     to PT-BR via the shared ESPN_TO_PT map; knockout slots still TBD show a
 *     placeholder ("2º A", "3º A/B/C…") until the groups resolve.
 * PT-BR: Espelha o torneio REAL (não o bolão): tabelas dos grupos e o chaveamento
 *        do mata-mata, lidos direto da API pública da ESPN (sem backend). A
 *        classificação vem do endpoint de standings (rank/pontos já calculados);
 *        o chaveamento, do scoreboard do mata-mata, agrupado por rodada. Os nomes
 *        são traduzidos pelo mapa ESPN_TO_PT; vagas ainda indefinidas mostram um
 *        rótulo ("2º A", "3º A/B/C…") até os grupos resolverem.
 *
 * @author Bruno Krieger
 */
(function () {
  "use strict";

  const STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
  const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260720";

  // Fases de um lado da chave, da externa (16avos) para a interna (semi).
  // / one side of the bracket, outer (R32) → inner (SF).
  const SIDE_ROUNDS = [
    { phase: "r32", title: "16 avos" },
    { phase: "r16", title: "Oitavas" },
    { phase: "qf", title: "Quartas" },
    { phase: "sf", title: "Semi" },
  ];

  let timer = null;

  /**
   * Entry point: shows the profile chip (if any) and loads the data.
   * Ponto de entrada: mostra o chip do perfil (se houver) e carrega os dados.
   *
   * @returns {void}
   */
  function init() {
    const profile = (typeof Storage !== "undefined") && Storage.getProfile();
    if (profile && typeof App !== "undefined") App.renderProfileChip(profile);
    const root = document.getElementById("gcRoot");
    load(root);
    if (!timer) {
      timer = setInterval(() => load(root, true), 120000); // atualiza sozinho / auto-refresh
      window.addEventListener("focus", () => load(root, true));
      // Redesenha as linhas da chave ao redimensionar / redraw lines on resize.
      let rz;
      window.addEventListener("resize", () => {
        clearTimeout(rz);
        rz = setTimeout(() => drawConnectors(root), 150);
      });
    }
  }

  /**
   * Fetches standings + knockout scoreboard from ESPN and renders both sections.
   * Busca standings + scoreboard do mata-mata na ESPN e renderiza as duas seções.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {boolean} [quiet] - Skip the loading message (used on auto-refresh) / Pula o "carregando".
   * @returns {Promise<void>}
   */
  async function load(root, quiet) {
    if (!root) return;
    if (!quiet) root.innerHTML = `<p class="rank-loading">Carregando grupos e chaveamento…</p>`;
    try {
      const [stRes, sbRes] = await Promise.all([
        fetch(STANDINGS, { cache: "no-store" }),
        fetch(SCOREBOARD, { cache: "no-store" }),
      ]);
      if (!stRes.ok) throw new Error("standings " + stRes.status);
      if (!sbRes.ok) throw new Error("scoreboard " + sbRes.status);
      const st = await stRes.json();
      const sb = await sbRes.json();
      render(root, st, sb.events || []);
    } catch (e) {
      if (!quiet) {
        root.innerHTML = `<div class="empty"><i class="empty__icon ti ti-alert-triangle" aria-hidden="true"></i>
          <p>Não consegui carregar os dados da ESPN agora.<br><small>${esc(e.message)}</small></p></div>`;
      }
      console.warn("[grupos]", e.message);
    }
  }

  // ---- Helpers ----

  /**
   * PT-BR name for an ESPN team name, or null when unknown.
   * Nome em PT-BR de um time da ESPN, ou null se desconhecido.
   *
   * @param {string} espn - ESPN displayName / displayName da ESPN.
   * @returns {?string}
   */
  function ptName(espn) {
    return (typeof ESPN_TO_PT !== "undefined" && ESPN_TO_PT[espn]) || null;
  }

  /**
   * Reads a numeric stat by name from a standings entry.
   * Lê uma estatística numérica pelo nome de uma entrada de standings.
   *
   * @param {Object} entry - Standings entry / Entrada de standings.
   * @param {string} name - Stat name / Nome da estatística.
   * @returns {number}
   */
  function statN(entry, name) {
    const s = (entry.stats || []).find((x) => x.name === name);
    if (!s) return 0;
    const v = (s.value != null) ? s.value : parseFloat(s.displayValue);
    return isNaN(v) ? 0 : v;
  }

  /**
   * Reads a stat's display text by name (keeps signs, e.g. "+2").
   * Lê o texto de exibição de uma estatística pelo nome (mantém sinais, ex.: "+2").
   *
   * @param {Object} entry - Standings entry / Entrada de standings.
   * @param {string} name - Stat name / Nome da estatística.
   * @returns {string}
   */
  function statD(entry, name) {
    const s = (entry.stats || []).find((x) => x.name === name);
    return s ? s.displayValue : "0";
  }

  // ---- Grupos / groups ----

  /**
   * Renders the 12 group tables (A–L), each sorted by rank.
   * Renderiza as 12 tabelas de grupo (A–L), cada uma ordenada por classificação.
   *
   * @param {Object} st - Standings payload / Resposta de standings.
   * @returns {string}
   */
  function renderGroups(st) {
    const groups = (st.children || []).slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "en"));
    if (!groups.length) return `<p class="gc-note">Sem dados de grupos no momento.</p>`;
    return `<div class="grp-grid">` + groups.map((g) => {
      const entries = ((g.standings && g.standings.entries) || []).slice()
        .sort((a, b) => statN(a, "rank") - statN(b, "rank"));
      const name = (g.name || "").replace(/^Group /, "Grupo ");
      const rows = entries.map((e, i) => groupRow(e, i)).join("");
      return `<div class="grp">
        <h3 class="grp__title">${esc(name)}</h3>
        <table class="grp__table">
          <thead><tr>
            <th>#</th><th class="grp__teamh">Seleção</th>
            <th title="Pontos">P</th><th title="Jogos">J</th>
            <th title="Vitórias">V</th><th title="Empates">E</th><th title="Derrotas">D</th>
            <th title="Gols pró">GP</th><th title="Gols contra">GC</th><th title="Saldo de gols">SG</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join("") + `</div>
    <p class="gc-legend"><span class="gc-legend__dot"></span> Zona de classificação (1º e 2º; os melhores 3º também avançam).</p>`;
  }

  /**
   * Builds one standings row (top 2 highlighted as the qualification zone).
   * Monta uma linha da tabela (os 2 primeiros destacados como zona de classificação).
   *
   * @param {Object} e - Standings entry / Entrada de standings.
   * @param {number} i - 0-based index / Índice (base 0).
   * @returns {string}
   */
  function groupRow(e, i) {
    const pos = i + 1;
    const espn = e.team && e.team.displayName;
    const pt = ptName(espn) || espn || "—";
    const cls = pos <= 2 ? " grp__row--qual" : "";
    return `<tr class="grp__row${cls}">
      <td class="grp__pos">${pos}</td>
      <td class="grp__team">${flagOf(pt)}<span class="grp__name">${esc(pt)}</span></td>
      <td class="grp__pts">${esc(statD(e, "points"))}</td>
      <td>${esc(statD(e, "gamesPlayed"))}</td>
      <td>${esc(statD(e, "wins"))}</td>
      <td>${esc(statD(e, "ties"))}</td>
      <td>${esc(statD(e, "losses"))}</td>
      <td>${esc(statD(e, "pointsFor"))}</td>
      <td>${esc(statD(e, "pointsAgainst"))}</td>
      <td>${esc(statD(e, "pointDifferential"))}</td>
    </tr>`;
  }

  // ---- Chaveamento / bracket ----

  // Estrutura da chave vem da NOSSA base (matches.js), que encoda a árvore via
  // "Ven. J##"; os times/placar reais vêm da ESPN (casados por horário).
  // / bracket TREE from our matches.js; real teams/scores from ESPN (by kickoff).

  /**
   * Index of our knockout matches by id.
   * Índice dos nossos jogos de mata-mata por id.
   *
   * @returns {Object<number, Object>}
   */
  function koById() {
    const by = {};
    (typeof MATCHES !== "undefined" ? MATCHES : []).forEach((m) => {
      if (m.phase !== "group") by[m.id] = m;
    });
    return by;
  }

  /**
   * The match ids that feed a given match ("Ven. J##" references).
   * Os ids dos jogos que alimentam um jogo ("Ven. J##").
   *
   * @param {Object} m - The match / O jogo.
   * @returns {number[]}
   */
  function childIds(m) {
    const ids = [];
    [m.home, m.away].forEach((s) => {
      const x = /Ven\.\s*J(\d+)/.exec(s || "");
      if (x) ids.push(Number(x[1]));
    });
    return ids;
  }

  /**
   * Post-order DFS from a semifinal id: orders each round top→bottom so feeders
   * line up with their parent.
   * DFS pós-ordem a partir de um id de semifinal: ordena cada fase de cima p/
   * baixo, alinhando os jogos com quem os alimenta.
   *
   * @param {number} rootId - Semifinal match id / Id da semifinal.
   * @param {Object} by - Knockout matches by id / Jogos por id.
   * @returns {{r32:number[], r16:number[], qf:number[], sf:number[]}}
   */
  function sideTree(rootId, by) {
    const out = { r32: [], r16: [], qf: [], sf: [] };
    (function rec(id) {
      const m = by[id];
      if (!m) return;
      const kids = childIds(m);
      if (kids.length === 2) { rec(kids[0]); rec(kids[1]); }
      if (out[m.phase]) out[m.phase].push(id);
    })(rootId);
    return out;
  }

  /**
   * Indexes ESPN knockout events by kickoff time (ms).
   * Indexa os jogos de mata-mata da ESPN pelo horário (ms).
   *
   * @param {Array} events - ESPN events / Jogos da ESPN.
   * @returns {Object<number, Object>}
   */
  function indexByTime(events) {
    const by = {};
    events.forEach((e) => { by[new Date(e.date).getTime()] = e; });
    return by;
  }

  /**
   * Finds the ESPN event for one of our matches by kickoff (±90 min tolerance).
   * Acha o jogo da ESPN para um jogo nosso pelo horário (tolerância de ±90 min).
   *
   * @param {Object} m - Our match / Nosso jogo.
   * @param {Object} idx - ESPN events by time / Jogos da ESPN por horário.
   * @returns {?Object}
   */
  function espnFor(m, idx) {
    const t = new Date(m.kickoff).getTime();
    if (idx[t]) return idx[t];
    let best = null, bestD = 90 * 60000;
    Object.keys(idx).forEach((k) => {
      const d = Math.abs(Number(k) - t);
      if (d <= bestD) { bestD = d; best = idx[k]; }
    });
    return best;
  }

  /**
   * Builds one knockout match box: real teams + score from ESPN when both sides
   * are decided, otherwise our PT placeholders ("2º A", "Ven. J##").
   * Monta um card do mata-mata: times + placar reais da ESPN quando os dois lados
   * estão definidos; senão, nossos rótulos em PT ("2º A", "Ven. J##").
   *
   * @param {Object} m - Our match / Nosso jogo.
   * @param {Object} idx - ESPN events by time / Jogos da ESPN por horário.
   * @returns {string}
   */
  function koMatch(m, idx) {
    if (!m) return "";
    const e = espnFor(m, idx);
    const cs = (e && e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
    const eh = cs.find((c) => c.homeAway === "home") || cs[0];
    const ea = cs.find((c) => c.homeAway === "away") || cs[1];
    const real = eh && ea && ptName(eh.team && eh.team.displayName) && ptName(ea.team && ea.team.displayName);
    const played = !!(e && e.status && e.status.type && e.status.type.state === "post");
    const sides = real
      ? [koSide(eh), koSide(ea)]
      : [{ name: m.home, tbd: true }, { name: m.away, tbd: true }];
    return '<div class="br__match" data-mid="' + m.id + '">' +
      sides.map((s) => koSideRow(s, played)).join("") + '</div>';
  }

  /**
   * Maps an ESPN competitor (a real team) to a side descriptor.
   * Converte um competidor da ESPN (time real) num descritor de lado.
   *
   * @param {Object} c - ESPN competitor / Competidor da ESPN.
   * @returns {{name:string, score:*, win:boolean}}
   */
  function koSide(c) {
    return {
      name: ptName(c.team && c.team.displayName) || (c.team && c.team.displayName) || "—",
      score: c.score,
      win: c.winner === true || c.advance === true,
    };
  }

  /**
   * Renders one side row of a knockout match.
   * Renderiza uma linha (lado) de um jogo do mata-mata.
   *
   * @param {{name:string, tbd?:boolean, score?:*, win?:boolean}} s - Side / Lado.
   * @param {boolean} played - Whether the match is finished / Se o jogo terminou.
   * @returns {string}
   */
  function koSideRow(s, played) {
    const label = s.tbd
      ? `<span class="br__teamname br__teamname--tbd">${esc(s.name)}</span>`
      : `${flagOf(s.name)}<span class="br__teamname">${esc(s.name)}</span>`;
    const score = (played && s.score != null) ? `<span class="br__score">${esc(String(s.score))}</span>` : "";
    return `<div class="br__side${s.win ? " br__side--win" : ""}">${label}${score}</div>`;
  }

  /**
   * Builds one bracket column (label on top + its matches spaced vertically).
   * Monta uma coluna da chave (rótulo no topo + jogos espalhados na vertical).
   *
   * @param {number[]} ids - Match ids, top→bottom / Ids dos jogos, de cima p/ baixo.
   * @param {Object} by - Knockout matches by id / Jogos por id.
   * @param {Object} idx - ESPN events by time / Jogos da ESPN por horário.
   * @param {string} title - Round label / Rótulo da rodada.
   * @returns {string}
   */
  function bracketCol(ids, by, idx, title) {
    const cells = (ids || []).map((id) => koMatch(by[id], idx)).join("");
    return `<div class="br2__col"><h4 class="br__round">${esc(title)}</h4><div class="br2__col-body">${cells}</div></div>`;
  }

  /**
   * Renders the two-sided bracket (16avos→Final converging to the center, with
   * the trophy) + the third-place match. Structure from matches.js, teams/scores
   * from ESPN.
   * Renderiza a chave em dois lados (16avos→Final convergindo ao centro, com o
   * troféu) + a disputa de 3º. Estrutura do matches.js; times/placar da ESPN.
   *
   * @param {Array} events - ESPN knockout events / Jogos do mata-mata da ESPN.
   * @returns {string}
   */
  function renderBracket(events) {
    if (typeof MATCHES === "undefined") return `<p class="gc-note">Estrutura do mata-mata indisponível.</p>`;
    const by = koById();
    const idx = indexByTime(events);
    const all = Object.values(by);
    const final = all.find((m) => m.phase === "final");
    const third = all.find((m) => m.phase === "third");
    const [leftSf, rightSf] = final ? childIds(final) : [];
    const left = sideTree(leftSf, by);
    const right = sideTree(rightSf, by);

    const leftCols = SIDE_ROUNDS
      .map((r) => bracketCol(left[r.phase], by, idx, r.title)).join("");
    const rightCols = SIDE_ROUNDS.slice().reverse()
      .map((r) => bracketCol(right[r.phase], by, idx, r.title)).join("");

    const center = `<div class="br2__center">
      <h4 class="br__round br2__final-label">Final</h4>
      ${final ? koMatch(final, idx) : ""}
      <div class="br2__trophy" title="Troféu da Copa do Mundo">
        <i class="ti ti-trophy" aria-hidden="true"></i>
        <span>Campeão</span>
      </div>
    </div>`;

    const thirdHtml = third
      ? `<div class="br2__third"><h4 class="br__round">Disputa de 3º lugar</h4>${koMatch(third, idx)}</div>`
      : "";

    return `<div class="br2">
      <div class="br2__side">${leftCols}</div>
      ${center}
      <div class="br2__side">${rightCols}</div>
    </div>${thirdHtml}`;
  }

  /**
   * Draws the green connector lines between each match and the two that feed it,
   * measuring the real positions after layout (so it adapts to width/resize).
   * Desenha as linhas verdes que ligam cada jogo aos dois que o alimentam,
   * medindo as posições reais após o layout (adapta à largura/resize).
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @returns {void}
   */
  function drawConnectors(root) {
    const br2 = root && root.querySelector(".br2");
    if (!br2 || typeof MATCHES === "undefined") return;
    const by = koById();
    const all = Object.values(by);
    const final = all.find((m) => m.phase === "final");
    const [leftSf, rightSf] = final ? childIds(final) : [];
    const right = sideTree(rightSf, by);
    const rightIds = new Set([].concat(right.r32, right.r16, right.qf, right.sf));

    const base = br2.getBoundingClientRect();
    const node = (id) => br2.querySelector('.br__match[data-mid="' + id + '"]');
    const cyOf = (n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2 - base.top; };
    const xOf = (n, side) => { const r = n.getBoundingClientRect(); return (side === "left" ? r.left : r.right) - base.left; };

    // SVG novo a cada desenho; <polyline> via createElementNS (innerHTML em SVG
    // não cria os nós no namespace certo). / fresh SVG, namespaced polylines.
    const NS = "http://www.w3.org/2000/svg";
    const oldSvg = br2.querySelector(".br2__lines");
    if (oldSvg) oldSvg.remove();
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "br2__lines");
    svg.setAttribute("viewBox", "0 0 " + Math.round(br2.offsetWidth) + " " + Math.round(br2.offsetHeight));
    svg.setAttribute("preserveAspectRatio", "none");
    br2.insertBefore(svg, br2.firstChild); // insere já / insert first, fill after

    try {
      all.forEach((m) => {
        const kids = childIds(m); // só "Ven. J##" (exclui 3º lugar) / winners only
        if (kids.length !== 2) return;
        const p = node(m.id);
        if (!p) return;
        kids.forEach((cid) => {
          const c = node(cid);
          if (!c) return;
          const childRight = rightIds.has(cid);            // criança no lado direito?
          const x1 = xOf(c, childRight ? "left" : "right"); // borda interna da criança
          const y1 = cyOf(c);
          const x2 = xOf(p, childRight ? "right" : "left"); // borda interna do pai
          const y2 = cyOf(p);
          const midX = (x1 + x2) / 2;
          const pl = document.createElementNS(NS, "polyline");
          pl.setAttribute("class", "br2__line");
          pl.setAttribute("points",
            x1.toFixed(1) + "," + y1.toFixed(1) + " " +
            midX.toFixed(1) + "," + y1.toFixed(1) + " " +
            midX.toFixed(1) + "," + y2.toFixed(1) + " " +
            x2.toFixed(1) + "," + y2.toFixed(1));
          svg.appendChild(pl);
        });
      });
    } catch (e) {
      console.warn("[grupos] linhas da chave", e.message);
    }
  }

  // ---- Render ----

  /**
   * Paints both sections into the page.
   * Pinta as duas seções na página.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {Object} st - Standings payload / Resposta de standings.
   * @param {Array} events - Knockout events / Jogos do mata-mata.
   * @returns {void}
   */
  function render(root, st, events) {
    root.innerHTML = `
      <section class="gc-section">
        <h2 class="section__title"><i class="ti ti-table" aria-hidden="true"></i> Grupos</h2>
        ${renderGroups(st)}
      </section>
      <section class="gc-section">
        <h2 class="section__title"><i class="ti ti-sitemap" aria-hidden="true"></i> Chaveamento</h2>
        <p class="gc-note">Os confrontos do mata-mata vão sendo preenchidos conforme os grupos terminam.</p>
        <div class="br-wrap">${renderBracket(events)}</div>
      </section>`;
    // Desenha as linhas após o layout assentar / draw lines after layout settles.
    setTimeout(() => drawConnectors(root), 60);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
