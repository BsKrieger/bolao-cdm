/**
 * @file Lineups + match stats / Escalações + estatísticas — via ESPN public API.
 *
 * EN:
 *  - Lazy: only fetches when the user opens "Escalações" on a match.
 *  - The client pulls STRAIGHT from ESPN (the API sends
 *    Access-Control-Allow-Origin: *), so no new backend and nothing is written
 *    to Supabase.
 *  - ESPN only publishes lineups near kickoff. Before that, we show a notice
 *    (graceful failure). Nothing breaks the rest of the site.
 *  - Reuses the ESPN→PT map and the time+teams matching from sync-results.
 * PT-BR:
 *  - Lazy: só busca quando o usuário abre "Escalações" num jogo.
 *  - O cliente puxa DIRETO da ESPN (a API manda Access-Control-Allow-Origin: *),
 *    então não precisa de backend novo nem de gravar nada no Supabase.
 *  - A ESPN só publica as escalações perto do início. Antes disso, mostramos um
 *    aviso (falha graciosa). Nada quebra o resto do site.
 *  - Reaproveita o mapa ESPN→PT e o casamento por horário+times do sync-results.
 *
 * @author Bruno Krieger
 */
const Lineup = (function () {
  /** ESPN scoreboard endpoint / endpoint do scoreboard da ESPN. */
  const SB = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  /** ESPN match summary endpoint / endpoint do resumo de jogo da ESPN. */
  const SUM = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

  // O mapa ESPN→PT agora é global, definido em data/espn-teams.js (compartilhado
  // com a página de Grupos/Chaveamento). / ESPN→PT map is now a shared global.

  const eventIdCache = {};  // matchId -> eventId | null
  const lineupCache = {};   // matchId -> parsed | null

  /**
   * Zero-pads a number to two digits.
   * Preenche um número com zero à esquerda (dois dígitos).
   *
   * @param {number} n
   * @returns {string}
   */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /**
   * UTC date window around the kickoff (±1 day) — covers the Americas' timezones.
   * Janela de datas (UTC) ao redor do jogo (±1 dia) — cobre os fusos das Américas.
   *
   * @param {string} kickoff - Kickoff ISO date / Data ISO do kickoff.
   * @returns {string} "YYYYMMDD-YYYYMMDD"
   */
  function rangeAround(kickoff) {
    const t = new Date(kickoff).getTime();
    const a = new Date(t - 86400000), b = new Date(t + 86400000);
    const s = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
    return s(a) + "-" + s(b);
  }

  /**
   * Whether the name is a real, known team (not a knockout placeholder).
   * Se o nome é uma seleção real e conhecida (não um slot de mata-mata).
   *
   * @param {string} name - Team name / Nome da seleção.
   * @returns {boolean}
   */
  function isRealTeam(name) {
    return typeof TEAMS !== "undefined" && !!TEAMS[name];
  }

  /**
   * Resolves the ESPN event id for one of our matches (cached). Matches by exact
   * kickoff time and, for real teams, by name in either orientation.
   * Descobre o id do evento na ESPN para um jogo nosso (cacheado). Casa pelo
   * horário exato e, para times reais, pelo nome nos dois sentidos.
   *
   * @param {Object} match - The match / O jogo.
   * @returns {Promise<string|null>} ESPN event id or null / Id do evento ou null.
   */
  async function resolveEventId(match) {
    if (match.id in eventIdCache) return eventIdCache[match.id];
    const r = await fetch(SB + "?dates=" + rangeAround(match.kickoff));
    if (!r.ok) throw new Error("scoreboard " + r.status);
    const d = await r.json();
    const target = new Date(match.kickoff).getTime();
    const byName = isRealTeam(match.home) && isRealTeam(match.away);
    let found = null;
    (d.events || []).forEach((e) => {
      if (found) return;
      if (Math.abs(new Date(e.date).getTime() - target) > 60000) return; // mesmo horário
      const cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
      if (!byName) { found = e.id; return; } // mata-mata: casa só pelo horário
      const h = cs.find((c) => c.homeAway === "home");
      const a = cs.find((c) => c.homeAway === "away");
      const hpt = h && ESPN_TO_PT[h.team && h.team.displayName];
      const apt = a && ESPN_TO_PT[a.team && a.team.displayName];
      // aceita os dois sentidos (a orientação real vem da própria ESPN)
      if ((hpt === match.home && apt === match.away) ||
          (hpt === match.away && apt === match.home)) found = e.id;
    });
    eventIdCache[match.id] = found || null;
    return eventIdCache[match.id];
  }

  /**
   * Matches an ESPN event to one of our matches (teams + time) — the inverse of
   * resolveEventId.
   * Casa um evento da ESPN com um dos nossos jogos (times + horário) — o inverso
   * do resolveEventId.
   *
   * @param {Object} e - ESPN scoreboard event / Evento do scoreboard da ESPN.
   * @returns {Object|null} Our match or null / Nosso jogo ou null.
   */
  function matchForEvent(e) {
    if (typeof MATCHES === "undefined") return null;
    const cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
    const h = cs.find((c) => c.homeAway === "home");
    const a = cs.find((c) => c.homeAway === "away");
    const hpt = h && ESPN_TO_PT[h.team && h.team.displayName];
    const apt = a && ESPN_TO_PT[a.team && a.team.displayName];
    const t = new Date(e.date).getTime();
    return MATCHES.find((m) => {
      if (Math.abs(new Date(m.kickoff).getTime() - t) > 60000) return false; // mesmo horário
      if (!hpt || !apt) return true;       // mata-mata sem nome confiável: casa só por horário
      return (hpt === m.home && apt === m.away) || (hpt === m.away && apt === m.home);
    }) || null;
  }

  /**
   * One call to the current scoreboard: returns a Set of OUR match ids that are
   * LIVE now (state === "in"). Cheap, client-side, no backend.
   * Uma chamada ao scoreboard atual: devolve um Set com os match_id dos NOSSOS
   * jogos AO VIVO agora (state === "in"). Barato, client-side, sem backend.
   *
   * @returns {Promise<Set<number>>}
   */
  async function liveMatchIds() {
    const r = await fetch(SB, { cache: "no-store" });
    if (!r.ok) throw new Error("scoreboard " + r.status);
    const d = await r.json();
    const ids = new Set();
    (d.events || []).forEach((e) => {
      if ((((e.status || {}).type || {}).state) !== "in") return; // só os em andamento
      const m = matchForEvent(e);
      if (m) ids.add(m.id);
    });
    return ids;
  }

  /**
   * Parses one ESPN roster into our team shape (starters only, with formation,
   * positions and per-player yellow/red card flags).
   * Converte um roster da ESPN no nosso formato de time (só titulares, com
   * formação, posições e flags de cartão amarelo/vermelho por jogador).
   *
   * @param {Object} t - ESPN roster entry / Entrada de roster da ESPN.
   * @returns {{homeAway:string, formation:string, team:string, players:Array}}
   */
  function parseTeam(t) {
    const players = (t.roster || []).filter((p) => p.starter).map((p) => {
      const cs = {};
      (p.stats || []).forEach((s) => { cs[s.name] = s.value; });
      return {
        name: (p.athlete && p.athlete.displayName) || "",
        jersey: p.jersey || "",
        pos: (p.position && p.position.abbreviation) || "",
        posName: (p.position && p.position.name) || "", // ex: "Right Back"
        yellow: (cs.yellowCards || 0) > 0,
        red: (cs.redCards || 0) > 0, // expulso / sent off
      };
    });
    return {
      homeAway: t.homeAway,
      formation: t.formation || "",
      team: (t.team && (ESPN_TO_PT[t.team.displayName] || t.team.displayName)) || "",
      players: players,
    };
  }

  /**
   * Loads lineups + stats + status for a match. Finished matches are cached
   * (they don't change); live/pre always refetch (stats keep updating).
   * Carrega escalações + estatísticas + status do jogo. Finalizado fica em cache
   * (não muda); ao vivo/pré sempre rebusca (as stats atualizam).
   *
   * @param {Object} match - The match / O jogo.
   * @returns {Promise<?{home:Object, away:Object, state:string, stats:Object, events:Array}>}
   *   Parsed data, or null when not available yet / Dados, ou null se indisponível.
   */
  async function loadLineup(match) {
    if (match.id in lineupCache) return lineupCache[match.id];
    const id = await resolveEventId(match);
    if (!id) return null;
    const r = await fetch(SUM + id);
    if (!r.ok) throw new Error("summary " + r.status);
    const d = await r.json();
    const ros = d.rosters || [];
    if (ros.length < 2) return null; // sem escalação ainda (não cacheia: tenta depois)
    const homeRos = ros.find((t) => t.homeAway === "home") || ros[0];
    const awayRos = ros.find((t) => t.homeAway === "away") || ros[1];
    const home = parseTeam(homeRos);
    const away = parseTeam(awayRos);
    if (!home.players.length && !away.players.length) return null;

    // Status (pre/in/post) e estatísticas do boxscore / status + boxscore stats.
    const comp = ((d.header && d.header.competitions) || [{}])[0] || {};
    const state = (((comp.status || {}).type || {}).state) || "post";
    const box = (d.boxscore && d.boxscore.teams) || [];
    const stats = {
      home: parseStats(box.find((t) => t.homeAway === "home") || box[0]),
      away: parseStats(box.find((t) => t.homeAway === "away") || box[1]),
    };
    // Lances (gols, cartões, substituições, pênaltis) / key events.
    const events = parseEvents(d.keyEvents,
      (homeRos.team || {}).displayName, (awayRos.team || {}).displayName);

    const parsed = { home, away, state, stats, events };
    if (state === "post") lineupCache[match.id] = parsed; // só finalizado é fixo
    return parsed;
  }

  /**
   * Turns boxscore.statistics into a map: { name: {v: number, d: text} }.
   * Transforma boxscore.statistics num mapa: { nome: {v: número, d: texto} }.
   *
   * @param {?Object} teamBox - One team's boxscore entry / Boxscore de um time.
   * @returns {Object<string, {v:number, d:string}>}
   */
  function parseStats(teamBox) {
    const map = {};
    if (teamBox) (teamBox.statistics || []).forEach((s) => {
      const v = (s.value != null) ? s.value : parseFloat(s.displayValue);
      map[s.name] = { v: isNaN(v) ? 0 : v, d: s.displayValue };
    });
    return map;
  }

  /**
   * Filters keyEvents down to what matters (goal/card/substitution/penalty) and
   * tags each with its side (home/away) and players involved.
   * Filtra os keyEvents para o que importa (gol/cartão/substituição/pênalti) e
   * marca cada um com o lado (home/away) e os jogadores envolvidos.
   *
   * @param {?Array} ke - ESPN keyEvents / keyEvents da ESPN.
   * @param {string} homeEN - Home team's ESPN name / Nome ESPN do mandante.
   * @param {string} awayEN - Away team's ESPN name / Nome ESPN do visitante.
   * @returns {Array<{clock:string, type:string, side:string, players:string[]}>}
   */
  function parseEvents(ke, homeEN, awayEN) {
    return (ke || []).filter((e) => {
      const t = ((e.type || {}).text || "").toLowerCase();
      return /goal|card|substitut|penal/.test(t);
    }).map((e) => {
      const tm = (e.team || {}).displayName || "";
      const parts = (e.participants || e.athletesInvolved || [])
        .map((p) => ((p.athlete || p).displayName) || "").filter(Boolean);
      return {
        clock: (e.clock || {}).displayValue || "",
        type: (e.type || {}).text || "",
        side: tm === homeEN ? "home" : (tm === awayEN ? "away" : ""),
        players: parts,
      };
    });
  }

  // ---- Pitch render (landscape) / render do campo (horizontal) ----
  /** Pitch viewBox size / tamanho do viewBox do campo. */
  const W = 620, H = 380;

  /**
   * Classifies a player from ESPN's REAL position (position.name).
   * depth = line: 0 GK, 1 def, 2 def-mid, 3 mid, 4 att-mid, 5 fwd.
   * lat = side: -1 left … +1 right (center = 0).
   * Classifica o jogador pela posição REAL da ESPN (position.name).
   * depth = linha: 0 GOL, 1 zaga, 2 volante, 3 meio, 4 meia-atac., 5 ataque.
   * lat = lado: -1 esq … +1 dir (centro = 0).
   *
   * @param {{posName?:string, pos?:string}} p - Player / Jogador.
   * @returns {{depth:number, lat:number}}
   */
  function classify(p) {
    const n = (p.posName || p.pos || "").toLowerCase();
    let depth;
    if (n.indexOf("goalkeeper") >= 0 || p.pos === "G") depth = 0;
    else if (n.indexOf("back") >= 0 || n.indexOf("defender") >= 0 || n.indexOf("sweeper") >= 0) depth = 1;
    else if (n.indexOf("defensive mid") >= 0) depth = 2;
    else if (n.indexOf("attacking mid") >= 0) depth = 4;
    else if (n.indexOf("mid") >= 0) depth = 3;
    else depth = 5; // forward / striker / winger
    let lat = 0;
    if (n.indexOf("center right") >= 0) lat = 0.5;
    else if (n.indexOf("center left") >= 0) lat = -0.5;
    else if (n.indexOf("right") >= 0) lat = 1;
    else if (n.indexOf("left") >= 0) lat = -1;
    return { depth, lat };
  }

  /**
   * Team lines from defense to attack, each sorted left→right — all derived from
   * ESPN's official positions.
   * Linhas do time, da defesa ao ataque, cada uma ordenada da esquerda p/ a
   * direita — tudo a partir da posição oficial da ESPN.
   *
   * @param {{players:Array}} team - The parsed team / O time já convertido.
   * @returns {Array<Array<Object>>} Lines of players / Linhas de jogadores.
   */
  function rows(team) {
    const buckets = {};
    team.players.forEach((p) => {
      const c = classify(p);
      (buckets[c.depth] = buckets[c.depth] || []).push({ p: p, lat: c.lat });
    });
    return Object.keys(buckets).map(Number).sort((a, b) => a - b).map((depth) =>
      buckets[depth].sort((a, b) => a.lat - b.lat).map((x) => x.p)
    );
  }

  /**
   * Short display name (last name, truncated) for the pitch.
   * Nome curto (sobrenome, truncado) para o campo.
   *
   * @param {string} name - Full name / Nome completo.
   * @returns {string}
   */
  function shortName(name) {
    const parts = String(name).trim().split(/\s+/);
    const s = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    return s.length > 11 ? s.slice(0, 10) + "…" : s;
  }

  /**
   * Small card rectangle (yellow/red) drawn next to a player's dot.
   * Cartão (retângulo) amarelo/vermelho desenhado ao lado da bolinha.
   *
   * @param {number} x - Dot x / x da bolinha.
   * @param {number} y - Dot y / y da bolinha.
   * @param {"yellow"|"red"} type - Card type / Tipo do cartão.
   * @returns {string} SVG <rect> / <rect> SVG.
   */
  function cardRect(x, y, type) {
    return '<rect x="' + (x + 7).toFixed(1) + '" y="' + (y - 18).toFixed(1) +
      '" width="5" height="7" rx="1" class="lp__card lp__card--' + type + '"/>';
  }

  /**
   * Renders one player node (dot + number + name) plus any card. Red = sent off
   * (faded name + red card); yellow = just the yellow card.
   * Renderiza um jogador (bolinha + número + nome) e o cartão, se houver.
   * Vermelho = expulso (nome apagado + cartão); amarelo = só o cartão.
   *
   * @param {number} x - x position / posição x.
   * @param {number} y - y position / posição y.
   * @param {Object} p - Player / Jogador.
   * @param {"left"|"right"} side - Home (left) or away (right) / Casa (esq) ou visitante (dir).
   * @returns {string} SVG group / Grupo SVG.
   */
  function playerNode(x, y, p, side) {
    const cls = side === "left" ? "lp__circle--home" : "lp__circle--away";
    const card = p.red ? cardRect(x, y, "red") : (p.yellow ? cardRect(x, y, "yellow") : "");
    return '<g>' +
      '<g class="' + (p.red ? "lp--sentoff" : "") + '">' +
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11" class="lp__circle ' + cls + '"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 3.5).toFixed(1) + '" class="lp__num">' + esc(p.jersey) + '</text>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 24).toFixed(1) + '" class="lp__name">' + esc(shortName(p.name)) + '</text>' +
      '</g>' + card +
      '</g>';
  }

  /**
   * Lays the team's lines as COLUMNS (goal → midfield), players spread
   * vertically. The away side is mirrored so the teams face each other.
   * Cada linha vira uma COLUNA (gol → meio), com os jogadores espalhados na
   * vertical. O lado visitante é espelhado para os times se enfrentarem.
   *
   * @param {Object} team - The parsed team / O time convertido.
   * @param {"left"|"right"} side - Home (left) or away (right) / Casa ou visitante.
   * @returns {string} SVG nodes / Nós SVG.
   */
  function placeNodes(team, side) {
    const ls = rows(team);
    const n = ls.length || 1;
    const xGoal = side === "left" ? 36 : W - 36;
    const xMid = side === "left" ? W / 2 - 26 : W / 2 + 26;
    let nodes = "";
    ls.forEach((line, idx) => {
      const rx = xGoal + (xMid - xGoal) * (idx / (n - 1 || 1));
      // espelha o lado direito p/ os times se enfrentarem (esq=topo / dir=base
      // invertidos), como num quadro tático. / mirror the away side.
      const row = side === "right" ? line.slice().reverse() : line;
      const m = row.length;
      row.forEach((p, k) => {
        const y = (k + 1) / (m + 1) * (H - 68) + 34;
        nodes += playerNode(rx, y, p, side);
      });
    });
    return nodes;
  }

  /**
   * Builds the whole pitch SVG (mowing stripes, markings, both lineups) plus the
   * header with team names and formations.
   * Monta o SVG completo do campo (faixas de corte, marcações, as duas
   * escalações) e o cabeçalho com nomes e formações dos times.
   *
   * @param {{home:Object, away:Object}} data - Parsed lineup data / Dados da escalação.
   * @returns {string} Header + SVG HTML / HTML do cabeçalho + SVG.
   */
  function pitch(data) {
    const cx = W / 2, cy = H / 2;
    // Gramado com faixas de corte / mowing stripes.
    let turf = "";
    const bands = 8, bw = W / bands;
    for (let i = 0; i < bands; i++) {
      turf += '<rect x="' + (i * bw).toFixed(1) + '" y="0" width="' + (bw + 0.5).toFixed(1) +
        '" height="' + H + '" class="pitch__stripe pitch__stripe--' + (i % 2 ? "b" : "a") + '"/>';
    }
    // "Lua" das áreas / penalty arcs.
    const arcL = "M70 " + (cy - 22).toFixed(1) + " A30 30 0 0 1 70 " + (cy + 22).toFixed(1);
    const arcR = "M" + (W - 70) + " " + (cy - 22).toFixed(1) + " A30 30 0 0 0 " + (W - 70) + " " + (cy + 22).toFixed(1);
    const marks =
      '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="4" class="pitch__line"/>' +
      '<line x1="' + cx + '" y1="6" x2="' + cx + '" y2="' + (H - 6) + '" class="pitch__line"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="34" class="pitch__line"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2.5" class="pitch__spot"/>' +
      // esquerda: área, pequena área, lua e marca do pênalti / left boxes + spot
      '<rect x="6" y="' + (cy - 70) + '" width="64" height="140" class="pitch__line"/>' +
      '<rect x="6" y="' + (cy - 32) + '" width="26" height="64" class="pitch__line"/>' +
      '<path d="' + arcL + '" class="pitch__line"/>' +
      '<circle cx="48" cy="' + cy + '" r="2.5" class="pitch__spot"/>' +
      // direita / right boxes + spot
      '<rect x="' + (W - 70) + '" y="' + (cy - 70) + '" width="64" height="140" class="pitch__line"/>' +
      '<rect x="' + (W - 32) + '" y="' + (cy - 32) + '" width="26" height="64" class="pitch__line"/>' +
      '<path d="' + arcR + '" class="pitch__line"/>' +
      '<circle cx="' + (W - 48) + '" cy="' + cy + '" r="2.5" class="pitch__spot"/>';
    return '' +
      '<div class="lineup__head">' +
        '<span class="lineup__team"><span class="lineup__dot lineup__dot--home"></span>' +
          esc(data.home.team) + ' · ' + esc(data.home.formation || "?") + '</span>' +
        '<span class="lineup__team">' + esc(data.away.team) + ' · ' + esc(data.away.formation || "?") +
          '<span class="lineup__dot lineup__dot--away"></span></span>' +
      '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pitch" role="img" aria-label="Escalações dos times">' +
        turf + marks + placeNodes(data.home, "left") + placeNodes(data.away, "right") +
      '</svg>';
  }

  // ---- Match stats / estatísticas do jogo ----
  /** "Resumo" tab: the 9 main stats (default page) / aba "Resumo": as 9 principais. */
  const STAT_ROWS = [
    { k: "possessionPct", label: "Posse de bola", pct: true },
    { k: "totalShots", label: "Finalizações" },
    { k: "shotsOnTarget", label: "Chutes no gol" },
    { k: "wonCorners", label: "Escanteios" },
    { k: "saves", label: "Defesas" },
    { k: "accuratePasses", label: "Passes certos" },
    { k: "totalTackles", label: "Desarmes" },
    { k: "interceptions", label: "Interceptações" },
    { k: "foulsCommitted", label: "Faltas" },
  ];

  /** "Tudo" tab: all 28 ESPN stats, grouped to tell the game's story / as 28 agrupadas. */
  const STAT_GROUPS = [
    { title: "Ataque", items: [
      { k: "totalShots", label: "Finalizações" },
      { k: "shotsOnTarget", label: "Chutes no gol" },
      { k: "blockedShots", label: "Finalizações bloqueadas" },
      { k: "shotPct", label: "% no alvo", ratio: true },
      { k: "wonCorners", label: "Escanteios" },
      { k: "offsides", label: "Impedimentos" },
      { k: "penaltyKickShots", label: "Pênaltis cobrados" },
      { k: "penaltyKickGoals", label: "Gols de pênalti" },
    ] },
    { title: "Posse e passes", items: [
      { k: "possessionPct", label: "Posse de bola", pct: true },
      { k: "totalPasses", label: "Passes" },
      { k: "accuratePasses", label: "Passes certos" },
      { k: "passPct", label: "% de passe", ratio: true },
      { k: "totalCrosses", label: "Cruzamentos" },
      { k: "accurateCrosses", label: "Cruzamentos certos" },
      { k: "crossPct", label: "% de cruzamento", ratio: true },
      { k: "totalLongBalls", label: "Bolas longas" },
      { k: "accurateLongBalls", label: "Bolas longas certas" },
      { k: "longballPct", label: "% de bola longa", ratio: true },
    ] },
    { title: "Defesa", items: [
      { k: "totalTackles", label: "Desarmes" },
      { k: "effectiveTackles", label: "Desarmes certos" },
      { k: "tacklePct", label: "% de desarme", ratio: true },
      { k: "interceptions", label: "Interceptações" },
      { k: "totalClearance", label: "Cortes" },
      { k: "effectiveClearance", label: "Cortes certos" },
      { k: "saves", label: "Defesas" },
    ] },
    { title: "Disciplina", items: [
      { k: "foulsCommitted", label: "Faltas" },
      { k: "yellowCards", label: "Cartões amarelos" },
      { k: "redCards", label: "Cartões vermelhos" },
    ] },
  ];

  /**
   * One comparison stat row (home value | label + 2-segment bar | away value).
   * Handles percentages (0-100), ratios (0-1) and plain counts.
   * Uma linha de estatística (casa | rótulo + barra de 2 segmentos | visitante).
   * Trata porcentagens (0-100), razões (0-1) e contagens simples.
   *
   * @param {Object} Hs - Home stats map / Mapa de stats do mandante.
   * @param {Object} As - Away stats map / Mapa de stats do visitante.
   * @param {{k:string, label:string, pct?:boolean, ratio?:boolean}} r - Row spec / Spec da linha.
   * @returns {string} Row HTML (or "" if both empty) / HTML da linha (ou "").
   */
  function statRow(Hs, As, r) {
    const h = Hs[r.k], a = As[r.k];
    if (!h && !a) return "";
    const hn = h ? h.v : 0, an = a ? a.v : 0;
    const tot = hn + an;
    const hp = tot ? Math.round((hn / tot) * 100) : 50;
    const fmt = (s) => !s ? (r.pct || r.ratio ? "0%" : "0")
      : r.pct ? Math.round(s.v) + "%"        // 0-100
      : r.ratio ? Math.round(s.v * 100) + "%" // 0-1
      : s.d;
    return '<div class="mstat">' +
      '<span class="mstat__v">' + esc(fmt(h)) + '</span>' +
      '<div class="mstat__mid"><span class="mstat__label">' + r.label + '</span>' +
      '<span class="mstat__bar"><span class="mstat__fill mstat__fill--h" style="width:' + hp + '%"></span>' +
      '<span class="mstat__fill mstat__fill--a" style="width:' + (100 - hp) + '%"></span></span></div>' +
      '<span class="mstat__v">' + esc(fmt(a)) + '</span></div>';
  }

  /**
   * "Lances" tab: the events timeline (goals, cards, subs, penalties) with an
   * icon and a description per event.
   * Aba "Lances": a linha do tempo de eventos (gols, cartões, substituições,
   * pênaltis) com um ícone e uma descrição por evento.
   *
   * @param {Array} events - Parsed key events / Lances já tratados.
   * @returns {string} Timeline HTML / HTML da linha do tempo.
   */
  function eventsPage(events) {
    if (!events || !events.length) return '<p class="lineup__msg">Sem lances registrados ainda.</p>';
    const icon = (type) => {
      const t = type.toLowerCase();
      if (t.indexOf("substitut") >= 0) return '<i class="ti ti-arrows-exchange ev__icon"></i>';
      if (t.indexOf("red card") >= 0) return '<span class="ev__card ev__card--red"></span>';
      if (t.indexOf("card") >= 0) return '<span class="ev__card ev__card--yellow"></span>';
      if (t.indexOf("penal") >= 0) return '<i class="ti ti-target-arrow ev__icon"></i>';
      return '<i class="ti ti-ball-football ev__icon"></i>'; // gol
    };
    const desc = (e) => {
      if (e.type.toLowerCase().indexOf("substitut") >= 0 && e.players.length >= 2)
        return '<b>' + esc(e.players[0]) + '</b> <span class="ev__out">↔ ' + esc(e.players[1]) + '</span>';
      return '<b>' + esc(e.players[0] || e.type) + '</b>';
    };
    return '<div class="evs">' + events.map((e) =>
      '<div class="ev ev--' + (e.side || "n") + '">' +
        '<span class="ev__min">' + esc(e.clock) + '</span>' +
        icon(e.type) +
        '<span class="ev__desc">' + desc(e) + '</span>' +
      '</div>').join("") + '</div>';
  }

  /**
   * Builds the stats panel with three tabs: Resumo (the 9 main), Tudo (all 28
   * grouped) and Lances (events). Returns "" before kickoff (no stats yet).
   * Monta o painel de stats com três abas: Resumo (as 9 principais), Tudo (as 28
   * agrupadas) e Lances (eventos). Retorna "" antes do início (sem stats).
   *
   * @param {{state:string, stats:Object, events:Array}} data - Parsed data / Dados.
   * @returns {string} Panel HTML (or "") / HTML do painel (ou "").
   */
  function statsPanel(data) {
    if (data.state === "pre") return ""; // jogo não começou: sem stats
    const Hs = data.stats.home || {}, As = data.stats.away || {};

    const resumo = STAT_ROWS.map((r) => statRow(Hs, As, r)).join("");
    if (!resumo) return "";
    const full = STAT_GROUPS.map((g) => {
      const rs = g.items.map((r) => statRow(Hs, As, r)).join("");
      return rs ? '<div class="mstats__group">' + g.title + '</div>' + rs : "";
    }).join("");
    // O selo "Ao vivo" agora fica no topo da caixa (renderBox), não nos títulos.
    // / live badge moved to the box top; titles stay clean.
    return '<div class="mstats">' +
      '<div class="mstats__nav">' +
        '<button type="button" class="mstats__tab is-active" data-view="resumo">Resumo</button>' +
        '<button type="button" class="mstats__tab" data-view="full">Tudo</button>' +
        '<button type="button" class="mstats__tab" data-view="events">Lances</button>' +
      '</div>' +
      '<div class="mstats__page" data-view="resumo">' +
        '<div class="mstats__title">Estatísticas</div>' +
        '<div class="mstats__rows">' + resumo + '</div></div>' +
      '<div class="mstats__page" data-view="full" hidden>' +
        '<div class="mstats__title">Todas as estatísticas</div>' + full + '</div>' +
      '<div class="mstats__page" data-view="events" hidden>' +
        '<div class="mstats__title">Lances do jogo</div>' + eventsPage(data.events) + '</div>' +
      '</div>';
  }

  /**
   * Reapplies the active tab after a re-render (survives the live refresh).
   * Reaplica a aba ativa após um re-render (sobrevive ao refresh ao vivo).
   *
   * @param {HTMLElement} box - The lineup box / A caixa de escalação.
   * @returns {void}
   */
  function applyView(box) {
    const wrap = box.querySelector(".mstats");
    if (!wrap) return;
    const view = box.dataset.view || "resumo";
    wrap.querySelectorAll(".mstats__tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
    wrap.querySelectorAll(".mstats__page").forEach((pg) => { pg.hidden = pg.dataset.view !== view; });
  }

  /**
   * Full content: pitch + stats side by side (stacks on mobile). The "Ao vivo"
   * badge lives on the card/block (Jogos & Galera), not inside here.
   * Conteúdo completo: campo + estatísticas lado a lado (empilha no mobile). O
   * selo "Ao vivo" vive no card/bloco (Jogos e Galera), não aqui dentro.
   *
   * @param {Object} data - Parsed lineup data / Dados da escalação.
   * @returns {string} Grid HTML / HTML do grid.
   */
  function renderBox(data) {
    const s = statsPanel(data);
    // O selo "Ao vivo" agora vive no card/bloco (Jogos e Galera), não aqui dentro.
    // / live badge now lives on the card/block, not inside the panel.
    return '<div class="lineup-grid">' +
      '<div class="lineup-grid__field">' + pitch(data) + '</div>' +
      (s ? '<div class="lineup-grid__stats">' + s + '</div>' : "") +
      '</div>';
  }

  /**
   * Whether an element is currently visible (rendered, not collapsed).
   * Se um elemento está visível agora (renderizado, não recolhido).
   *
   * @param {?HTMLElement} el - The element / O elemento.
   * @returns {boolean}
   */
  function isVisible(el) { return !!(el && el.offsetParent !== null); }

  /**
   * Live match: refreshes the stats in the background (~1 min) while the box is
   * visible. Stops when the match ends or the box is removed.
   * Jogo ao vivo: atualiza as stats em segundo plano (~1 min) enquanto a caixa
   * estiver visível. Para quando o jogo acaba ou a caixa some.
   *
   * @param {HTMLElement} box - The lineup box / A caixa de escalação.
   * @param {Object} match - The match / O jogo.
   * @returns {void}
   */
  function startLive(box, match) {
    if (box._live) return;
    box._live = setInterval(() => {
      if (!document.body.contains(box)) { clearInterval(box._live); box._live = null; return; }
      if (!isVisible(box)) return; // recolhido: não busca agora
      loadLineup(match).then((data) => {
        if (!data) return;
        box.innerHTML = renderBox(data);
        applyView(box); // mantém a aba que o usuário estava vendo / keep tab
        if (data.state !== "in") { clearInterval(box._live); box._live = null; } // acabou
      }).catch(() => {});
    }, 60000);
  }

  // ---- Load lineup into a box / carrega a escalação numa caixa ----

  /**
   * Loads and renders a lineup into a box (idempotent via dataset flags). Used
   * by the button (Jogos, on demand) and directly (Galera, inline). Starts the
   * live refresh when the match is in progress.
   * Carrega e renderiza uma escalação numa caixa (idempotente via flags do
   * dataset). Usado pelo botão (Jogos, sob demanda) e direto (Galera, inline).
   * Inicia o refresh ao vivo quando o jogo está em andamento.
   *
   * @param {HTMLElement} box - The lineup box / A caixa de escalação.
   * @returns {void}
   */
  function loadInto(box) {
    if (!box || box.dataset.loading || box.dataset.rendered) return;
    const id = Number(box.getAttribute("data-lineup-box"));
    const match = (typeof MATCHES !== "undefined") && MATCHES.find((m) => m.id === id);
    if (!match) { box.innerHTML = '<p class="lineup__msg">Jogo não encontrado.</p>'; box.dataset.rendered = "1"; return; }
    box.dataset.loading = "1";
    box.innerHTML = '<p class="lineup__msg">Carregando escalações…</p>';
    loadLineup(match).then((data) => {
      delete box.dataset.loading;
      if (!data) {
        // sem escalação ainda: não marca como pronto (tenta de novo ao reabrir)
        box.innerHTML = '<p class="lineup__msg">Escalação ainda não disponível para este jogo (a ESPN libera perto do início).</p>';
        return;
      }
      box.dataset.rendered = "1";
      box.innerHTML = renderBox(data);
      applyView(box);
      if (data.state === "in") startLive(box, match); // estatísticas ao vivo
    }).catch((err) => {
      delete box.dataset.loading; // permite tentar de novo ao reabrir / allow retry
      box.innerHTML = '<p class="lineup__msg">Não consegui carregar a escalação agora.</p>';
      console.warn("[lineup]", err.message);
    });
  }

  /**
   * Wires global click delegation: the stats tabs (Resumo/Tudo/Lances) and the
   * "Escalações" button toggle (lazy load on first open).
   * Liga a delegação de clique global: as abas de stats (Resumo/Tudo/Lances) e o
   * botão "Escalações" (carga preguiçosa na 1ª abertura).
   *
   * @returns {void}
   */
  function init() {
    document.addEventListener("click", (e) => {
      // Abas das estatísticas (Resumo / Tudo / Lances) / stats tabs.
      const tab = e.target.closest(".mstats__tab");
      if (tab) {
        const box = tab.closest(".lineup-box");
        if (box) { box.dataset.view = tab.dataset.view; applyView(box); }
        return;
      }
      const btn = e.target.closest(".lineup-btn");
      if (!btn) return;
      const box = document.querySelector('.lineup-box[data-lineup-box="' + btn.getAttribute("data-lineup") + '"]');
      if (!box) return;
      if (!box.hidden) { box.hidden = true; btn.setAttribute("aria-expanded", "false"); return; }
      box.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      loadInto(box);
    });
  }

  init();
  return { loadLineup, show: loadInto, liveMatchIds };
})();
