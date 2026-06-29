/**
 * @file World Cup statistics / Estatísticas da Copa.
 *
 * EN: Tournament-wide stats from ESPN's public APIs (no backend): individual
 *     leaders (goals, assists, cards) from the core "leaders" endpoint; per-team
 *     ranking (goals, cards, fouls…) from each team's statistics; and figures
 *     derived from the scoreboard (attendance, goals, biggest wins, win streak).
 *     Player/team names are translated to PT-BR via the shared ESPN_TO_PT map.
 * PT-BR: Estatísticas do torneio a partir das APIs públicas da ESPN (sem backend):
 *        líderes individuais (gols, assistências, cartões) do endpoint "leaders";
 *        ranking por seleção (gols, cartões, faltas…) das estatísticas de cada
 *        time; e números derivados do scoreboard (público, gols, maiores
 *        goleadas, sequência de vitórias). Nomes traduzidos pelo mapa ESPN_TO_PT.
 *
 * @author Bruno Krieger
 */
(function () {
  "use strict";

  const BASE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026/types/1";
  const LEADERS_URL = BASE + "/leaders";
  const TEAM_STATS = (id) => BASE + "/teams/" + id + "/statistics";
  const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
  const SB = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  // A ESPN limita ~100 eventos por chamada; busco em blocos / fetch in chunks.
  const RANGES = ["20260611-20260627", "20260628-20260710", "20260711-20260720"];

  // Categorias de líderes a exibir / leader categories to show.
  const LEADER_CATS = [
    { key: "goals", title: "Artilharia", icon: "ti-ball-football", n: 10, unit: "gols" },
    { key: "assists", title: "Assistências", icon: "ti-shoe", n: 10, unit: "assist." },
    { key: "yellowCards", title: "Cartões amarelos", icon: "ti-rectangle-vertical", n: 6, unit: "amarelos" },
    { key: "redCards", title: "Cartões vermelhos", icon: "ti-rectangle-vertical", n: 6, unit: "vermelhos" },
  ];

  const _cache = {};

  /**
   * Entry point: shows the profile chip (if any) and loads the stats.
   * Ponto de entrada: mostra o chip do perfil (se houver) e carrega as estatísticas.
   *
   * @returns {void}
   */
  function init() {
    const profile = (typeof Storage !== "undefined") && Storage.getProfile();
    if (profile && typeof App !== "undefined") App.renderProfileChip(profile);
    load(document.getElementById("estatRoot"));
  }

  /**
   * Fetches a JSON URL once (cached for re-renders).
   * Busca uma URL JSON uma vez (cacheada para re-renders).
   *
   * @param {string} u - URL.
   * @returns {Promise<Object>}
   */
  async function fetchJson(u) {
    // A ESPN devolve alguns $ref em http://; força https p/ evitar bloqueio de
    // conteúdo misto quando o site roda em https.
    // ESPN returns some $ref as http://; force https to avoid mixed-content block.
    const url = u.replace(/^http:\/\//i, "https://");
    if (_cache[url]) return _cache[url];
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    _cache[url] = d;
    return d;
  }

  /**
   * Runs an async mapper over items with limited concurrency (kind to the API).
   * Roda um mapeador assíncrono com concorrência limitada (gentil com a API).
   *
   * @param {Array} items - Items / Itens.
   * @param {Function} fn - async (item, index) => result.
   * @param {number} [size=8] - Max parallel / Máx. em paralelo.
   * @returns {Promise<Array>}
   */
  async function pool(items, fn, size) {
    size = size || 8;
    const res = [];
    let i = 0;
    // Cada worker consome itens da fila até esvaziar (concorrência limitada).
    async function worker() {
      while (i < items.length) {
        const idx = i++;
        try { res[idx] = await fn(items[idx], idx); } catch (e) { res[idx] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, worker));
    return res;
  }

  /**
   * Fetches all scoreboard events across the date chunks, de-duped by id.
   * Busca todos os eventos do scoreboard nos blocos de datas, sem duplicar.
   *
   * @returns {Promise<Array>}
   */
  async function fetchEvents() {
    const byId = {};
    await pool(RANGES, async (range) => {
      try {
        const d = await fetchJson(SB + "?dates=" + range);
        (d.events || []).forEach((e) => { byId[e.id] = e; });
      } catch (e) { /* ignora bloco que falhar */ }
    }, 3);
    return Object.values(byId);
  }

  /**
   * Loads everything and renders, or shows an error.
   * Carrega tudo e renderiza, ou mostra um erro.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @returns {Promise<void>}
   */
  async function load(root) {
    if (!root) return;
    root.innerHTML = `<p class="rank-loading">Carregando estatísticas da Copa… <small>(puxa bastante coisa da ESPN, pode levar alguns segundos)</small></p>`;
    try {
      const [leaders, standings, events] = await Promise.all([
        fetchJson(LEADERS_URL),
        fetchJson(STANDINGS_URL),
        fetchEvents(),
      ]);

      // id da seleção -> nome (inglês) a partir do standings / team id -> name.
      const nameById = {};
      const teamIds = [];
      (standings.children || []).forEach((g) =>
        ((g.standings && g.standings.entries) || []).forEach((e) => {
          if (e.team && e.team.id) { nameById[e.team.id] = e.team.displayName; teamIds.push(e.team.id); }
        }));

      const [leaderBlocks, teamRanks] = await Promise.all([
        buildLeaders(leaders, nameById),
        buildTeamRanks(teamIds, nameById),
      ]);

      render(root, {
        numbers: tournamentNumbers(events),
        leaders: leaderBlocks,
        goleadas: biggestWins(events),
        teamRanks: teamRanks,
      });
    } catch (e) {
      root.innerHTML = `<div class="empty"><i class="empty__icon ti ti-alert-triangle" aria-hidden="true"></i>
        <p>Não consegui carregar as estatísticas da ESPN agora.<br><small>${esc(e.message)}</small></p></div>`;
      console.warn("[estatisticas]", e.message);
    }
  }

  // ---- Líderes individuais / individual leaders ----

  /**
   * Team (PT) of a leader, taken from the team id in its $ref + the standings map.
   * Seleção (PT) de um líder, pelo id do time no $ref + o mapa do standings.
   *
   * @param {Object} leader - Leader entry / Entrada de líder.
   * @param {Object} nameById - team id -> English name / id -> nome inglês.
   * @returns {?string} PT-BR team name / Nome da seleção em PT-BR.
   */
  function leaderTeam(leader, nameById) {
    const ref = (leader.team && leader.team.$ref) || "";
    const m = /\/teams\/(\d+)/.exec(ref);
    const en = m && nameById[m[1]];
    if (!en) return null;
    return (typeof ESPN_TO_PT !== "undefined" && ESPN_TO_PT[en]) || en;
  }

  /**
   * Builds the leader blocks, resolving each athlete's name from its $ref.
   * Monta os blocos de líderes, resolvendo o nome de cada atleta pelo $ref.
   *
   * @param {Object} leaders - Leaders payload / Resposta de leaders.
   * @param {Object} nameById - team id -> name / id -> nome.
   * @returns {Promise<Array>}
   */
  async function buildLeaders(leaders, nameById) {
    const cats = leaders.categories || [];
    return Promise.all(LEADER_CATS.map(async (spec) => {
      const cat = cats.find((c) => c.name === spec.key);
      const top = ((cat && cat.leaders) || []).slice(0, spec.n);
      const rows = await pool(top, async (L) => {
        let player = "—";
        try {
          if (L.athlete && L.athlete.$ref) {
            const a = await fetchJson(L.athlete.$ref);
            player = a.displayName || "—";
          }
        } catch (e) { /* mantém "—" */ }
        return { player: player, team: leaderTeam(L, nameById), value: L.value };
      });
      return { spec: spec, rows: rows.filter(Boolean) };
    }));
  }

  // ---- Ranking por seleção / per-team ranking ----

  /**
   * Reads a numeric stat by name from a team's statistics payload.
   * Lê uma estatística numérica pelo nome na resposta de statistics de um time.
   *
   * @param {Object} ts - Team statistics payload / Resposta de statistics.
   * @param {string} name - Stat name / Nome da estatística.
   * @returns {number}
   */
  function teamStat(ts, name) {
    const cats = (ts && ts.splits && ts.splits.categories) || [];
    for (const c of cats) {
      const s = (c.stats || []).find((x) => x.name === name);
      if (s) { const v = (s.value != null) ? s.value : parseFloat(s.displayValue); return isNaN(v) ? 0 : v; }
    }
    return 0;
  }

  /**
   * Fetches every team's statistics (pooled) and builds the per-team ranking rows.
   * Busca as estatísticas de cada time (com pool) e monta as linhas do ranking.
   *
   * @param {Array<string>} teamIds - Team ids / Ids das seleções.
   * @param {Object} nameById - team id -> name / id -> nome.
   * @returns {Promise<Array>}
   */
  async function buildTeamRanks(teamIds, nameById) {
    const rows = await pool(teamIds, async (id) => {
      const ts = await fetchJson(TEAM_STATS(id));
      const en = nameById[id] || "";
      const pt = (typeof ESPN_TO_PT !== "undefined" && ESPN_TO_PT[en]) || en;
      const yellow = teamStat(ts, "yellowCards");
      const red = teamStat(ts, "redCards");
      return {
        team: pt,
        goals: teamStat(ts, "totalGoals"),
        cards: yellow + red,
        yellow: yellow,
        red: red,
        fouls: teamStat(ts, "foulsCommitted"),
        cleanSheet: teamStat(ts, "cleanSheet"),
      };
    });
    return rows.filter(Boolean);
  }

  // ---- Derivados do scoreboard / scoreboard-derived ----

  /**
   * Whether an event is finished / Se um jogo terminou.
   * @param {Object} e
   * @returns {boolean}
   */
  function isDone(e) {
    const t = e.status && e.status.type;
    return !!(t && (t.completed || t.state === "post"));
  }

  /** Competitors (home, away) of an event / competidores de um jogo. */
  function sides(e) {
    const cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
    return {
      home: cs.find((c) => c.homeAway === "home") || cs[0],
      away: cs.find((c) => c.homeAway === "away") || cs[1],
      attendance: (e.competitions && e.competitions[0] && e.competitions[0].attendance) || 0,
    };
  }

  /** Goals as a number / gols como número. */
  function gnum(c) { const v = c && (c.score != null ? Number(c.score) : NaN); return isNaN(v) ? 0 : v; }

  /**
   * Headline tournament numbers from the finished games.
   * Números-resumo do torneio a partir dos jogos finalizados.
   *
   * @param {Array} events
   * @returns {Object}
   */
  function tournamentNumbers(events) {
    let played = 0, goals = 0, attTotal = 0, attCount = 0, attMax = null;
    events.forEach((e) => {
      if (!isDone(e)) return;
      const s = sides(e);
      played++;
      goals += gnum(s.home) + gnum(s.away);
      if (s.attendance > 0) {
        attTotal += s.attendance; attCount++;
        if (!attMax || s.attendance > attMax.value) {
          attMax = { value: s.attendance, label: ptTeam(teamName(s.home)) + " × " + ptTeam(teamName(s.away)) };
        }
      }
    });
    return {
      played: played,
      goals: goals,
      avgGoals: played ? (goals / played) : 0,
      attTotal: attTotal,
      attAvg: attCount ? Math.round(attTotal / attCount) : 0,
      attMax: attMax,
    };
  }

  /** English team name of a competitor / nome (inglês) do competidor. */
  function teamName(c) { return (c && c.team && c.team.displayName) || ""; }
  /** PT-BR name from an English name / nome PT-BR a partir do inglês. */
  function ptTeam(en) { return (typeof ESPN_TO_PT !== "undefined" && ESPN_TO_PT[en]) || en || "—"; }

  /**
   * Biggest wins (by goal margin, then total goals), top 6.
   * Maiores goleadas (pela diferença de gols, depois total), top 6.
   *
   * @param {Array} events
   * @returns {Array}
   */
  function biggestWins(events) {
    return events.filter(isDone).map((e) => {
      const s = sides(e);
      const hg = gnum(s.home), ag = gnum(s.away);
      return {
        home: ptTeam(teamName(s.home)), away: ptTeam(teamName(s.away)),
        hg: hg, ag: ag, margin: Math.abs(hg - ag), total: hg + ag,
      };
    }).sort((a, b) => b.margin - a.margin || b.total - a.total).slice(0, 6);
  }

  // ---- Render ----

  /**
   * Highlight class for the 1st/2nd place of any ranking (green, like the max /
   * positive score highlights). / classe de destaque p/ 1º e 2º de qualquer ranking.
   *
   * @param {number} i - 0-based index / Índice (base 0).
   * @returns {string}
   */
  function rankHl(i) {
    return i === 0 ? " estat-1" : i === 1 ? " estat-2" : "";
  }

  /**
   * Renders all stat sections into the page.
   * Renderiza todas as seções de estatística na página.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {Object} data - Computed stats / Estatísticas calculadas.
   * @returns {void}
   */
  function render(root, data) {
    root.innerHTML =
      numbersSection(data.numbers) +
      leadersSection(data.leaders) +
      goleadasSection(data.goleadas) +
      teamRankSection(data.teamRanks);
  }

  /**
   * "Números da Copa" cards + best win streak.
   * Cards de "Números da Copa" + melhor sequência de vitórias.
   *
   * @param {Object} n - Tournament numbers / Números do torneio.
   * @param {?Object} streak - Best streak / Melhor sequência.
   * @returns {string}
   */
  function numbersSection(n) {
    const card = (value, label, sub) =>
      `<div class="estat-num"><span class="estat-num__v">${value}</span><span class="estat-num__l">${label}</span>` +
      (sub ? `<span class="estat-num__sub">${sub}</span>` : "") + `</div>`;
    const fmtInt = (x) => Math.round(x).toLocaleString("pt-BR");
    const cards = [
      card(n.played, "jogos disputados"),
      card(n.goals, "gols no total"),
      card((Math.round(n.avgGoals * 100) / 100).toString().replace(".", ","), "gols por jogo"),
      card(fmtInt(n.attTotal), "público total"),
      card(fmtInt(n.attAvg), "público médio"),
      card(n.attMax ? fmtInt(n.attMax.value) : "—", "maior público", n.attMax ? esc(n.attMax.label) : ""),
    ].join("");
    return `<section class="gc-section">
      <h2 class="section__title"><i class="ti ti-chart-bar" aria-hidden="true"></i> Números da Copa</h2>
      <div class="estat-nums">${cards}</div>
    </section>`;
  }

  /**
   * Leader boards (goals, assists, cards) as ranked lists.
   * Quadros de líderes (gols, assistências, cartões) em listas ranqueadas.
   *
   * @param {Array} blocks - Leader blocks / Blocos de líderes.
   * @returns {string}
   */
  function leadersSection(blocks) {
    // Valor: pílula amarela/vermelha (estilo Noir) nos cartões; número simples nos demais.
    const pill = (key, val) => {
      if (key === "yellowCards") return `<span class="estat-pill estat-pill--yellow">${esc(String(val))}</span>`;
      if (key === "redCards") return `<span class="estat-pill estat-pill--red">${esc(String(val))}</span>`;
      return esc(String(val));
    };
    const cols = blocks.map((b) => {
      if (!b.rows.length) return "";
      const rows = b.rows.map((r, i) => `<li class="estat-row${rankHl(i)}">
        <span class="estat-row__pos">${i + 1}</span>
        <span class="estat-row__name">${esc(r.player)}</span>
        <span class="estat-row__team">${r.team ? flagOf(r.team) : ""}</span>
        <span class="estat-row__val">${pill(b.spec.key, r.value)}</span>
      </li>`).join("");
      return `<div class="estat-board">
        <h3 class="estat-board__title"><i class="ti ${b.spec.icon}" aria-hidden="true"></i> ${b.spec.title}</h3>
        <ol class="estat-list">${rows}</ol>
      </div>`;
    }).join("");
    return `<section class="gc-section">
      <h2 class="section__title"><i class="ti ti-trophy" aria-hidden="true"></i> Líderes</h2>
      <div class="estat-boards">${cols}</div>
    </section>`;
  }

  /**
   * "Maiores goleadas" list.
   * Lista de "Maiores goleadas".
   *
   * @param {Array} list - Biggest wins / Maiores goleadas.
   * @returns {string}
   */
  function goleadasSection(list) {
    if (!list.length) return "";
    const items = list.map((g) => `<div class="estat-gol">
      <span class="estat-gol__t">${flagOf(g.home)} ${esc(g.home)}</span>
      <span class="estat-gol__s">${g.hg} × ${g.ag}</span>
      <span class="estat-gol__t estat-gol__t--away">${esc(g.away)} ${flagOf(g.away)}</span>
    </div>`).join("");
    return `<section class="gc-section">
      <h2 class="section__title"><i class="ti ti-flame" aria-hidden="true"></i> Maiores goleadas</h2>
      <div class="estat-gols">${items}</div>
    </section>`;
  }

  /**
   * Per-team ranking table (goals, cards, fouls, clean sheets), sorted by goals.
   * Tabela de ranking por seleção (gols, cartões, faltas, jogos sem sofrer gol),
   * ordenada por gols.
   *
   * @param {Array} rows - Team rows / Linhas das seleções.
   * @returns {string}
   */
  function teamRankSection(rows) {
    if (!rows.length) return "";
    const sorted = rows.slice().sort((a, b) => b.goals - a.goals || b.cleanSheet - a.cleanSheet);
    const body = sorted.map((r, i) => `<tr class="${rankHl(i).trim()}">
      <td class="estat-trk__pos">${i + 1}</td>
      <td class="estat-trk__team">${flagOf(r.team)}<span>${esc(r.team)}</span></td>
      <td>${r.goals}</td>
      <td><span class="estat-pill estat-pill--yellow">${r.yellow}</span> <span class="estat-pill estat-pill--red">${r.red}</span></td>
      <td>${r.fouls}</td>
      <td>${r.cleanSheet}</td>
    </tr>`).join("");
    return `<section class="gc-section">
      <h2 class="section__title"><i class="ti ti-shield-half" aria-hidden="true"></i> Ranking por seleção</h2>
      <p class="gc-note">Ordenado por gols marcados. Cartões: <span class="estat-pill estat-pill--yellow">amarelos</span> <span class="estat-pill estat-pill--red">vermelhos</span>.</p>
      <div class="estat-trk-wrap">
        <table class="estat-trk">
          <thead><tr>
            <th>#</th><th class="estat-trk__teamh">Seleção</th>
            <th title="Gols marcados">Gols</th><th title="Cartões">Cartões</th>
            <th title="Faltas cometidas">Faltas</th><th title="Jogos sem sofrer gol">CS</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
