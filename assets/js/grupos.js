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

  // Rodadas do mata-mata, em ordem de exibição / knockout rounds, display order.
  const ROUNDS = [
    { slug: "round-of-32", title: "16 avos" },
    { slug: "round-of-16", title: "Oitavas" },
    { slug: "quarterfinals", title: "Quartas" },
    { slug: "semifinals", title: "Semis" },
    { slug: "final", title: "Final" },
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

  /**
   * Translates an ESPN knockout slot label into a short PT-BR placeholder.
   * Traduz o rótulo de uma vaga do mata-mata da ESPN para um placeholder curto PT-BR.
   *
   * @param {string} s - ESPN slot label / Rótulo da vaga na ESPN.
   * @returns {string}
   */
  function slotLabel(s) {
    if (!s) return "A definir";
    let m;
    if ((m = s.match(/^Group (\w+) Winner$/i))) return "1º " + m[1];
    if ((m = s.match(/^Group (\w+) (\d)(?:st|nd|rd|th) Place$/i))) return m[2] + "º " + m[1];
    if ((m = s.match(/^Third Place Group ([\w/]+)$/i))) return "3º " + m[1];
    if ((m = s.match(/Winner.* (\d+)$/i))) return "Ven. " + m[1];
    return s; // rótulo cru (fallback) / raw label
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

  /**
   * Renders the bracket columns (R32→Final) + the third-place match, bucketing
   * the knockout events by round.
   * Renderiza as colunas do chaveamento (R32→Final) + a disputa de 3º, agrupando
   * os jogos do mata-mata por rodada.
   *
   * @param {Array} events - ESPN knockout events / Jogos do mata-mata da ESPN.
   * @returns {string}
   */
  function renderBracket(events) {
    const byRound = {};
    events.forEach((e) => {
      const slug = (e.season && e.season.slug) || "?";
      (byRound[slug] = byRound[slug] || []).push(e);
    });
    const cols = ROUNDS.map((r) => {
      const evs = (byRound[r.slug] || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      const body = evs.length ? evs.map(matchCard).join("") : `<p class="br__empty">A definir</p>`;
      return `<div class="br__col"><h3 class="br__round">${r.title}</h3>${body}</div>`;
    }).join("");
    const third = (byRound["3rd-place-match"] || [])[0];
    const thirdHtml = third
      ? `<div class="br__third"><h3 class="br__round">Disputa de 3º lugar</h3>${matchCard(third)}</div>`
      : "";
    return `<div class="br">${cols}</div>${thirdHtml}`;
  }

  /**
   * One knockout match card (two sides + score once played).
   * Um card de jogo do mata-mata (dois lados + placar quando jogado).
   *
   * @param {Object} e - ESPN event / Jogo da ESPN.
   * @returns {string}
   */
  function matchCard(e) {
    const c = e.competitions && e.competitions[0];
    const cs = (c && c.competitors) || [];
    const home = cs.find((x) => x.homeAway === "home") || cs[0];
    const away = cs.find((x) => x.homeAway === "away") || cs[1];
    const played = !!(e.status && e.status.type && e.status.type.state === "post");
    return `<div class="br__match">${sideRow(home, played)}${sideRow(away, played)}</div>`;
  }

  /**
   * One side of a knockout match (flag + name or TBD slot, score, winner mark).
   * Um lado de um jogo do mata-mata (bandeira + nome ou vaga, placar, vencedor).
   *
   * @param {?Object} c - Competitor / Competidor.
   * @param {boolean} played - Whether the match is finished / Se o jogo terminou.
   * @returns {string}
   */
  function sideRow(c, played) {
    if (!c) return `<div class="br__side"><span class="br__teamname br__teamname--tbd">A definir</span></div>`;
    const espn = c.team && c.team.displayName;
    const pt = ptName(espn);
    const label = pt
      ? `${flagOf(pt)}<span class="br__teamname">${esc(pt)}</span>`
      : `<span class="br__teamname br__teamname--tbd">${esc(slotLabel(espn))}</span>`;
    const win = c.winner === true || c.advance === true;
    const score = (played && c.score != null) ? `<span class="br__score">${esc(String(c.score))}</span>` : "";
    return `<div class="br__side${win ? " br__side--win" : ""}">${label}${score}</div>`;
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
