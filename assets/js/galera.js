/**
 * @file Everyone's picks / Palpites da galera.
 *
 * EN: Shows each participant's prediction per match — but ONLY after the match
 *     starts (locks). Nothing is revealed before kickoff. Reads from Supabase.
 *     Live matches get a badge + green highlight (ESPN status).
 * PT-BR: Mostra o palpite de cada participante por jogo — mas SÓ depois que o
 *        jogo começa (trava). Antes do início, nada é revelado. Lê tudo do
 *        Supabase. Jogos ao vivo ganham selo + realce verde (status da ESPN).
 *
 * @author Bruno Krieger
 */
(function () {
  let liveTimer = null; // intervalo do refresh "ao vivo" / live refresh timer

  /**
   * Entry point: shows the profile chip, then loads everyone's picks (or an
   * empty state when the backend is off).
   * Ponto de entrada: mostra o chip do perfil e carrega os palpites de todos
   * (ou um estado vazio quando o backend está off).
   *
   * @returns {void}
   */
  function init() {
    const profile = Storage.getProfile();
    if (profile) App.renderProfileChip(profile);

    const root = document.getElementById("galeraRoot");
    if (typeof DB === "undefined" || !DB.ready()) {
      root.innerHTML = empty('<i class="empty__icon ti ti-users" aria-hidden="true"></i>',
        "Os palpites compartilhados precisam do backend configurado.");
      return;
    }
    load(root, profile && profile.id);
  }

  /**
   * Fetches predictions + results and renders the blocks (or an error).
   * Busca palpites + resultados e renderiza os blocos (ou um erro).
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {Promise<void>}
   */
  async function load(root, myId) {
    root.innerHTML = `<p class="rank-loading">Carregando palpites…</p>`;
    try {
      const [data, rt] = await Promise.all([DB.fetchAll(), App.loadResults(), KoTeams.hydrate(MATCHES)]);
      render(root, data, rt.res, myId);
    } catch (e) {
      root.innerHTML = empty('<i class="empty__icon ti ti-alert-triangle" aria-hidden="true"></i>',
        `Não consegui carregar os palpites.<br><small>${esc(e.message)}</small>`);
    }
  }

  /**
   * Empty/error state block.
   * Bloco de estado vazio/erro.
   *
   * @param {string} icon - Icon markup (e.g. <i class="empty__icon ti ..."></i>) / HTML do ícone.
   * @param {string} msg - Message HTML / HTML da mensagem.
   * @returns {string}
   */
  function empty(icon, msg) {
    return `<div class="empty">${icon}<p>${msg}</p></div>`;
  }

  /**
   * Groups predictions by match id.
   * Agrupa os palpites por id de jogo.
   *
   * @param {Array<{match_id:number}>} predictions - Prediction rows / Linhas de palpite.
   * @returns {Object<number, Array>} match_id → [ {participant_id, home, away, advances} ]
   */
  function indexPredictions(predictions) {
    const byMatch = {};
    predictions.forEach((p) => {
      (byMatch[p.match_id] = byMatch[p.match_id] || []).push(p);
    });
    return byMatch;
  }

  /**
   * Renders the bonus section + one collapsible block per started match (most
   * recent first, first one open), then wires inline lineups and live marking.
   * Renderiza a seção de bônus + um bloco recolhível por jogo iniciado (mais
   * recente primeiro, o 1º aberto), e liga as escalações inline e o "ao vivo".
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @param {{participants:Array, predictions:Array, bonus:Array}} data - Data / Dados.
   * @param {Object<number, Object>} results - Results by id / Resultados por id.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {void}
   */
  function render(root, data, results, myId) {
    const byMatch = indexPredictions(data.predictions);
    const names = {};
    data.participants.forEach((p) => (names[p.id] = p.name));

    // Bônus (campeão + artilheiro) só aparece depois que a Copa começa.
    const bonusHtml = tournamentStarted() ? bonusSection(data.bonus, names, myId) : "";

    // Só jogos que já começaram (travados), mais recentes primeiro.
    const started = MATCHES
      .filter((m) => isLocked(m))
      .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));

    if (!started.length) {
      root.innerHTML = bonusHtml + empty('<i class="empty__icon ti ti-lock" aria-hidden="true"></i>',
        "<strong>Nenhum jogo começou ainda.</strong>");
      return;
    }

    // 1º bloco (jogo mais recente) já aberto; o resto recolhido p/ reduzir poluição.
    // First block (most recent match) open; the rest collapsed to reduce clutter.
    root.innerHTML = bonusHtml + started
      .map((m, i) => matchBlock(m, byMatch[m.id] || [], names, results[m.id], myId, i === 0))
      .join("");

    // Escalações inline: carrega a do bloco aberto e as demais ao expandir.
    // Inline lineups: load the open block now, the rest on expand (auto).
    if (typeof Lineup !== "undefined") {
      root.querySelectorAll("details.galera__match").forEach((dt) => {
        const box = dt.querySelector(".lineup-box");
        if (!box) return;
        if (dt.open) Lineup.show(box);
        dt.addEventListener("toggle", () => { if (dt.open) Lineup.show(box); });
      });
    }

    // Selo "ao vivo" + realce verde nos blocos em andamento (status da ESPN).
    // Atualiza sozinho a cada ~60s e quando a aba volta ao foco. / live marking.
    markLive(root);
    if (!liveTimer) {
      liveTimer = setInterval(() => markLive(root), 60000);
      window.addEventListener("focus", () => markLive(root));
      document.addEventListener("visibilitychange", () => { if (!document.hidden) markLive(root); });
    }
  }

  /** Reusable live badge markup / markup reutilizável do selo "ao vivo". */
  const LIVE_BADGE = '<span class="live-badge"><span class="live-dot"></span> Ao vivo</span>';

  /**
   * Marks the blocks whose matches are LIVE now (ESPN status): badge next to the
   * flags when collapsed, centered when open (CSS picks one). Removes both badge
   * and highlight once the match ends.
   * Marca os blocos cujos jogos estão AO VIVO agora (status da ESPN): selo ao
   * lado das bandeiras quando recolhido, centralizado quando aberto (o CSS
   * escolhe). Remove selo e realce quando o jogo acaba.
   *
   * @param {HTMLElement} root - Container / Contêiner.
   * @returns {void}
   */
  function markLive(root) {
    if (typeof Lineup === "undefined" || !Lineup.liveMatchIds) return;
    Lineup.liveMatchIds().then((ids) => {
      root.querySelectorAll("details.galera__match").forEach((dt) => {
        const isLive = ids.has(Number(dt.dataset.id));
        dt.classList.toggle("is-live", isLive);
        if (isLive) addLiveBadges(dt); else removeLiveBadges(dt);
      });
    }).catch((e) => console.warn("[galera] ao vivo", e.message));
  }

  /**
   * Adds two badges (idempotent): one next to the flags (collapsed) and one
   * centered (open). CSS shows only the right one per [open] state.
   * Adiciona dois selos (idempotente): um junto às bandeiras (recolhido) e um
   * centralizado (aberto). O CSS mostra só o certo conforme [open].
   *
   * @param {HTMLDetailsElement} dt - The match block / O bloco do jogo.
   * @returns {void}
   */
  function addLiveBadges(dt) {
    const teams = dt.querySelector(".galera__teams");
    if (teams && !teams.querySelector(".galera__live--head")) {
      const h = document.createElement("span");
      h.className = "galera__live--head";
      h.innerHTML = LIVE_BADGE;
      teams.appendChild(h); // logo após a bandeira do time visitante
    }
    const summary = dt.querySelector("summary");
    if (summary && !dt.querySelector(":scope > .galera__live--body")) {
      const b = document.createElement("div");
      b.className = "galera__live--body";
      b.innerHTML = LIVE_BADGE;
      summary.insertAdjacentElement("afterend", b);
    }
  }

  /**
   * Removes both live badges from a block.
   * Remove os dois selos "ao vivo" de um bloco.
   *
   * @param {HTMLDetailsElement} dt - The match block / O bloco do jogo.
   * @returns {void}
   */
  function removeLiveBadges(dt) {
    dt.querySelectorAll(".galera__live--head, .galera__live--body").forEach((x) => x.remove());
  }

  /**
   * Whether the tournament has started (now >= first kickoff).
   * Se a Copa começou (agora >= primeiro kickoff).
   *
   * @returns {boolean}
   */
  function tournamentStarted() {
    return Date.now() >= Math.min(...MATCHES.map((m) => new Date(m.kickoff).getTime()));
  }

  /**
   * Collapsible section with everyone's champion + top-scorer picks.
   * Seção recolhível com o campeão + artilheiro escolhidos por cada um.
   *
   * @param {Array} bonus - Bonus rows / Linhas de bônus.
   * @param {Object<*, string>} names - id → name / id → nome.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @returns {string} Section HTML (or "") / HTML da seção (ou "").
   */
  function bonusSection(bonus, names, myId) {
    const cards = (bonus || [])
      .filter((b) => b.champion || b.top_scorer)
      .sort((a, b) => (names[a.participant_id] || "")
        .localeCompare(names[b.participant_id] || "", "pt-BR"))
      .map((b) => {
        const me = (myId && b.participant_id === myId) ? " galera__bcard--me" : "";
        const champ = b.champion ? `${flagOf(b.champion)} ${esc(b.champion)}` : "—";
        const scorer = b.top_scorer ? esc(b.top_scorer) : "—";
        return `<div class="galera__bcard${me}">
          <span class="galera__bname">${esc(names[b.participant_id] || "—")}</span>
          <span class="galera__brow"><span class="galera__blabel"><i class="ti ti-trophy" aria-hidden="true"></i> Campeão</span>${champ}</span>
          <span class="galera__brow"><span class="galera__blabel"><i class="ti ti-ball-football" aria-hidden="true"></i> Artilheiro</span>${scorer}</span>
        </div>`;
      }).join("");
    if (!cards) return "";
    return `<details class="galera__bonus">
      <summary class="galera__bonus-head">
        <h2 class="galera__bonus-title">Palpites bônus — campeão e artilheiro</h2>
        <i class="ti ti-chevron-down galera__chev" aria-hidden="true"></i>
      </summary>
      <div class="galera__bonus-grid">${cards}</div>
    </details>`;
  }

  /**
   * Builds one collapsible match block (header, stats card, lineup box, picks).
   * Monta um bloco recolhível de jogo (cabeçalho, card de stats, escalação,
   * palpites).
   *
   * @param {Object} m - The match / O jogo.
   * @param {Array} picks - Predictions for this match / Palpites deste jogo.
   * @param {Object<*, string>} names - id → name / id → nome.
   * @param {?Object} res - The result / O resultado.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @param {boolean} open - Start expanded? (only the most recent) / Começa aberto?
   * @returns {string} <details> HTML / HTML do <details>.
   */
  function matchBlock(m, picks, names, res, myId, open) {
    const result = res && res.home != null
      ? `<span class="galera__result">${res.home} × ${res.away}</span>` : "";

    const valid = picks
      .filter((p) => p.home != null && p.away != null)
      .sort((a, b) => (names[a.participant_id] || "")
        .localeCompare(names[b.participant_id] || "", "pt-BR"));

    const picksHtml = valid.length
      ? valid.map((p) => pickRow(m, p, names, myId, res)).join("")
      : `<p class="galera__none">Ninguém palpitou neste jogo.</p>`;

    // <details>/<summary> = expandir/recolher nativo, sem JS de evento.
    return `<details class="galera__match" data-id="${m.id}"${open ? " open" : ""}>
      <summary class="galera__head">
        <span class="galera__teams">${flagOf(m.home)} ${m.home} <b>×</b> ${m.away} ${flagOf(m.away)}</span>
        <span class="galera__head-right">
          ${result}
          <span class="galera__count" title="palpites neste jogo">${valid.length}</span>
          <i class="ti ti-chevron-down galera__chev" aria-hidden="true"></i>
        </span>
      </summary>
      ${statsCard(m, valid, res)}
      <div class="lineup-box" data-lineup-box="${m.id}"></div>
      <div class="galera__picks">${picksHtml}</div>
    </details>`;
  }

  /**
   * Stats card: centered scoreboard between the flags + the prediction split
   * (home % / draw % / away %).
   * Card de estatísticas: placar centralizado entre as bandeiras + a divisão dos
   * palpites (% mandante / % empate / % visitante).
   *
   * @param {Object} m - The match / O jogo.
   * @param {Array} valid - Valid predictions / Palpites válidos.
   * @param {?Object} res - The result / O resultado.
   * @returns {string} Card HTML (or "" if no picks) / HTML do card (ou "" sem palpites).
   */
  function statsCard(m, valid, res) {
    const n = valid.length;
    if (!n) return "";
    let h = 0, d = 0, a = 0;
    valid.forEach((p) => {
      if (p.home > p.away) h++; else if (p.home < p.away) a++; else d++;
    });
    const pct = (x) => Math.round((x / n) * 100);
    const score = (res && res.home != null) ? `${res.home} × ${res.away}` : "×";
    const side = (team, count) =>
      `<div class="gstats__side">
        <span class="gstats__flag">${flagOf(team)}</span>
        <span class="gstats__team">${esc(team)}</span>
        <span class="gstats__pct">${pct(count)}%</span>
        <span class="gstats__cnt">${count} ${count === 1 ? "palpite" : "palpites"}</span>
      </div>`;
    return `<div class="gstats">
      <div class="gstats__board">
        ${side(m.home, h)}
        <div class="gstats__mid">
          <span class="gstats__score">${score}</span>
          <span class="gstats__draw">Empate<strong>${pct(d)}%</strong></span>
        </div>
        ${side(m.away, a)}
      </div>
      <div class="gstats__foot">${n} ${n === 1 ? "palpite" : "palpites"} no total</div>
    </div>`;
  }

  /**
   * Builds one participant pick row (name, score, advancement, points). Points
   * and the score-based highlight (max/positive/zero) appear only once scored.
   * Monta uma linha de palpite (nome, placar, avanço, pontos). Os pontos e o
   * destaque (máxima/positivo/zero) só aparecem quando o jogo é pontuado.
   *
   * @param {Object} m - The match / O jogo.
   * @param {Object} p - The participant's prediction / O palpite do participante.
   * @param {Object<*, string>} names - id → name / id → nome.
   * @param {?(string|number)} myId - Current participant id / Id do participante atual.
   * @param {?Object} res - The result / O resultado.
   * @returns {string} Row HTML / HTML da linha.
   */
  function pickRow(m, p, names, myId, res) {
    const me = (myId && p.participant_id === myId) ? " galera__pick--me" : "";
    const name = esc(names[p.participant_id] || "—");
    const adv = (Scoring.KO_ADVANCE.has(m.phase) && p.advances)
      ? `<span class="galera__adv"><i class="ti ti-arrow-narrow-right" aria-hidden="true"></i> ${p.advances === "home" ? esc(m.home) : esc(m.away)}</span>` : "";

    // Pontos + destaque só quando o jogo já tem resultado / only when scored.
    let stateCls = "", pts = "";
    if (res && res.home != null) {
      const sc = Scoring.scoreMatch(m, { home: p.home, away: p.away, advances: p.advances }, res);
      stateCls = sc.total <= 0 ? " galera__pick--zero"
        : (Scoring.isMax(m, sc) ? " galera__pick--max" : " galera__pick--pos");
      pts = `<span class="galera__pts">${fmtPts(sc.total)} pts</span>`;
    }

    return `<div class="galera__pick${me}${stateCls}">
      <span class="galera__name">${name}</span>
      <span class="galera__score">${p.home} × ${p.away}</span>
      ${adv}
      ${pts}
    </div>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
