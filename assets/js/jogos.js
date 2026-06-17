/**
 * @file Matches & predictions screen / Tela de Jogos & Palpites.
 *
 * EN:
 *  - Lists the 104 matches by phase (group stage split by group).
 *  - Score inputs with autosave; the "today" shortcut mirrors cards by match_id.
 *  - Per-match countdown with auto-lock at kickoff + live badge (ESPN status).
 * PT-BR:
 *  - Lista os 104 jogos por fase (fase de grupos subdividida por grupo).
 *  - Campos de palpite com salvamento automático; o atalho "hoje" espelha cards
 *    pelo match_id. Contador por jogo, trava no kickoff e selo ao vivo (ESPN).
 *
 * @author Bruno Krieger
 */
(function () {
  /** Display order of the phases / ordem de exibição das fases. */
  const PHASE_ORDER = ["group", "r32", "r16", "qf", "sf", "third", "final"];
  /** Phases that have a "who advances" pick / fases com "quem avança". */
  const ADVANCE_PHASES = new Set(["r32", "r16", "qf", "sf"]);

  /**
   * Entry point: requires a profile, then starts.
   * Ponto de entrada: exige um perfil e então inicia.
   *
   * @returns {void}
   */
  function init() { App.requireProfile(start); }

  /**
   * Builds the whole screen and wires every handler (predictions, bonus,
   * countdowns, filter, live marking + the focus/visibility revalidation).
   * Monta a tela inteira e liga todos os handlers (palpites, bônus, contadores,
   * filtro, marcação ao vivo + revalidação por foco/visibilidade).
   *
   * @returns {void}
   */
  function start() {
    const root = document.getElementById("matchesRoot");
    root.innerHTML = buildTodaySection() + PHASE_ORDER.map(buildPhaseSection).join("");
    showResults(); // placar real dos jogos já encerrados
    renderBonus();
    scheduleBonusAutoLock();
    attachScoreHandlers();
    attachAdvanceHandlers();
    registerCountdowns();
    setupFilter();
    Countdown.tick(); // primeira atualização imediata
    markLiveMatches();                    // selo "ao vivo" nos cards (status da ESPN)
    setInterval(markLiveMatches, 60000);  // mantém o "ao vivo" atualizado / keep fresh

    // Ao voltar pra aba (celular trava contador em 2º plano), revalida na hora.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { revalidateLocks(); markLiveMatches(); } });
    window.addEventListener("pageshow", revalidateLocks);
    window.addEventListener("focus", () => { revalidateLocks(); markLiveMatches(); });
  }

  /**
   * Marks the cards whose matches are in progress now, reading the status
   * straight from ESPN (one call). Adds the centered top badge + green border;
   * the footer "Fechado" lock STAYS (the score remains locked).
   * Marca como "ao vivo" os cards cujos jogos estão em andamento agora, lendo o
   * status direto da ESPN (uma chamada). Adiciona o selo centralizado no topo e a
   * borda verde; o cadeado "Fechado" do rodapé PERMANECE (o placar segue travado).
   *
   * @returns {void}
   */
  function markLiveMatches() {
    if (typeof Lineup === "undefined" || !Lineup.liveMatchIds) return;
    Lineup.liveMatchIds().then((ids) => {
      document.querySelectorAll(".match[data-id]").forEach((card) => {
        const id = Number(card.dataset.id);
        const isLive = ids.has(id);
        card.classList.toggle("is-live", isLive);
        let badge = card.querySelector(".match__live");
        if (isLive && !badge) {
          badge = document.createElement("div");
          badge.className = "match__live";
          badge.innerHTML = '<span class="live-badge"><span class="live-dot"></span> Ao vivo</span>';
          card.insertBefore(badge, card.firstChild); // topo, centralizado
        } else if (!isLive && badge) {
          badge.remove();
        }
      });
    }).catch((e) => console.warn("[jogos] ao vivo", e.message));
  }

  /**
   * Shows the OFFICIAL score on finished matches, next to the prediction. Reads
   * from the DB (with fallback) and injects a line into each card.
   * Mostra o placar OFICIAL nos jogos já encerrados, ao lado do palpite. Lê do
   * banco (com fallback) e injeta uma linha em cada card.
   *
   * @returns {void}
   */
  function showResults() {
    if (typeof App === "undefined" || !App.loadResults) return;
    App.loadResults().then(({ res }) => {
      MATCHES.forEach((m) => {
        const r = res && res[m.id];
        if (!r || r.home == null) return;                 // sem resultado: nada
        document.querySelectorAll(`.match[data-id="${m.id}"]`).forEach((card) => {
          if (card.querySelector(".match__result")) return;
          const row = card.querySelector(".match__row");
          if (!row) return;
          const el = document.createElement("div");
          el.className = "match__result";
          el.innerHTML = `Resultado oficial: <strong>${r.home} × ${r.away}</strong>`;
          row.insertAdjacentElement("afterend", el);
        });
      });
    }).catch((e) => console.warn("[jogos] resultados", e.message));
  }

  // ---- Palpites bônus (campeã + artilheiro) / bonus picks ----

  /**
   * Timestamp of the first kickoff (the tournament start).
   * Timestamp do primeiro kickoff (início da Copa).
   *
   * @returns {number} Epoch ms / Epoch em ms.
   */
  function firstKickoff() {
    return Math.min(...MATCHES.map((m) => new Date(m.kickoff).getTime()));
  }

  /**
   * Whether the bonus picks are locked (tournament has started).
   * Se os palpites bônus estão travados (a Copa já começou).
   *
   * @returns {boolean}
   */
  function bonusLocked() {
    return Date.now() >= firstKickoff();
  }

  /**
   * Live auto-lock: if the page stays open, re-renders the (now locked) bonus
   * exactly at the first kickoff. Guards against the setTimeout overflow limit.
   * Trava ao vivo: se a página ficar aberta, re-renderiza o bônus (já travado)
   * exatamente quando a bola rolar no 1º jogo. Protege contra o limite do
   * setTimeout.
   *
   * @returns {void}
   */
  function scheduleBonusAutoLock() {
    if (bonusLocked()) return;
    const remaining = firstKickoff() - Date.now();
    const MAX_TIMEOUT = 2147483647; // ~24,8 dias: limite do setTimeout (evita overflow)
    if (remaining <= 0 || remaining > MAX_TIMEOUT) return;
    setTimeout(renderBonus, remaining + 500); // +0,5s p/ garantir que já passou do kickoff
  }

  /**
   * Builds the top-scorer <optgroup>/<option> list from SCORERS, grouped by
   * country and marking the chosen player. A saved value outside the list is
   * kept visible as "(fora da lista)" so nothing disappears silently.
   * Monta os <optgroup>/<option> do artilheiro a partir de SCORERS, agrupados
   * por país e marcando o jogador escolhido. Um valor salvo fora da lista fica
   * visível como "(fora da lista)" — nada some calado.
   *
   * @param {?string} selected - Currently saved player / Jogador salvo atual.
   * @returns {string} Options HTML / HTML das opções.
   */
  function buildScorerOptions(selected) {
    const sel = selected || "";
    let found = false;
    let html = `<option value="">— escolha o jogador —</option>`;
    if (typeof SCORERS !== "undefined") {
      for (const grp of SCORERS) {
        html += `<optgroup label="${esc(grp.country)}">`;
        for (const name of grp.players) {
          const isSel = name === sel;
          if (isSel) found = true;
          html += `<option value="${esc(name)}"${isSel ? " selected" : ""}>${esc(name)}</option>`;
        }
        html += `</optgroup>`;
      }
    }
    // Valor salvo antigo que não está na lista: mantém visível p/ não sumir calado.
    if (sel && !found) {
      html = `<option value="${esc(sel)}" selected>${esc(sel)} (fora da lista)</option>` + html;
    }
    return html;
  }

  /**
   * Renders the bonus section (champion picker + top-scorer select). When locked
   * it shows a read-only "Fechado" state; otherwise it wires the handlers.
   * Renderiza a seção de bônus (seletor de campeã + select de artilheiro).
   * Travada, mostra o estado "Fechado"; senão, liga os handlers.
   *
   * @returns {void}
   */
  function renderBonus() {
    const root = document.getElementById("bonusRoot");
    if (!root) return;
    const bonus = Storage.getBonus();
    const locked = bonusLocked();
    root.classList.toggle("bonus--locked", locked); // mesmo destaque dos jogos travados
    const dis = locked ? "disabled" : "";
    const teams = Object.keys(TEAMS).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const opts = teams.map((t) =>
      `<button type="button" class="cselect__opt" data-val="${t}">${flagOf(t)} <span>${t}</span></button>`).join("");
    const btnLabel = bonus.champion
      ? `${flagOf(bonus.champion)} ${bonus.champion}`
      : `<span class="cselect__ph">— escolha a seleção —</span>`;
    root.innerHTML = `
      <h2 class="section__title">Palpites bônus</h2>
      ${locked ? "" : `<p class="bonus__note">Valem no fim da Copa: campeã 20 pts · artilheiro 15 pts. Travam quando a bola rolar no 1º jogo.</p>`}
      <div class="bonus__grid">
        <div class="bonus__field">
          <span class="bonus__label">Seleção campeã</span>
          <div class="cselect" id="championSelect" data-value="${bonus.champion || ""}">
            <button type="button" class="cselect__btn" id="championBtn" ${dis}>${btnLabel}</button>
            <div class="cselect__list" id="championList" hidden>${opts}</div>
          </div>
        </div>
        <label class="bonus__field">
          <span class="bonus__label">Artilheiro da Copa</span>
          <select id="bonusTopScorer" class="bonus__input bonus__select" ${dis}>
            ${buildScorerOptions(bonus.topScorer)}
          </select>
        </label>
      </div>
      <div class="match__foot">
        <span class="status ${locked ? "status--locked" : ""}">${locked ? '<i class="ti ti-lock" aria-hidden="true"></i> Fechado — a Copa já começou.' : ""}</span>
        <span class="saved" id="bonusSaved"></span>
      </div>`;
    if (!locked) attachBonusHandlers();
  }

  /**
   * Wires the champion dropdown (open/close, pick, outside-click) and the
   * top-scorer select, saving on every change.
   * Liga o dropdown da campeã (abrir/fechar, escolher, clique fora) e o select
   * de artilheiro, salvando a cada mudança.
   *
   * @returns {void}
   */
  function attachBonusHandlers() {
    const btn = document.getElementById("championBtn");
    const list = document.getElementById("championList");
    const top = document.getElementById("bonusTopScorer");
    if (btn && list) {
      btn.addEventListener("click", (e) => { e.stopPropagation(); list.hidden = !list.hidden; });
      list.querySelectorAll(".cselect__opt").forEach((opt) =>
        opt.addEventListener("click", () => {
          document.getElementById("championSelect").dataset.value = opt.dataset.val;
          btn.innerHTML = flagOf(opt.dataset.val) + " " + opt.dataset.val;
          list.hidden = true;
          saveBonusNow();
        }));
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#championSelect")) list.hidden = true;
      });
    }
    if (top) top.addEventListener("change", saveBonusNow);
  }

  /**
   * Reads the current champion + top-scorer choices and saves the bonus,
   * updating the "salvo/erro" tag.
   * Lê as escolhas atuais de campeã + artilheiro e salva o bônus, atualizando a
   * etiqueta "salvo/erro".
   *
   * @returns {void}
   */
  function saveBonusNow() {
    const sel = document.getElementById("championSelect");
    const champion = sel ? (sel.dataset.value || "") : "";
    const topScorer = ((document.getElementById("bonusTopScorer") || {}).value || "").trim();
    const ok = Storage.saveBonus({ champion, topScorer });
    const tag = document.getElementById("bonusSaved");
    if (tag) {
      tag.innerHTML = ok ? 'salvo <i class="ti ti-check" aria-hidden="true"></i>' : "erro ao salvar";
      tag.classList.toggle("saved--ok", ok);
    }
  }

  // ---- Construção do HTML / HTML building ----

  /**
   * Calendar date (YYYY-MM-DD) in Brasília time.
   * Data de calendário (YYYY-MM-DD) em horário de Brasília.
   *
   * @param {Date} d - The date / A data.
   * @returns {string}
   */
  function brDay(d) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  }

  /**
   * Pinned shortcut at the top: TODAY's still-open matches; if today is over,
   * the next matchday. Never empty for no reason and helps find what's left to
   * predict. These cards mirror the ones below (same match_id, kept in sync).
   * Atalho fixo no topo: jogos de HOJE ainda abertos; se hoje já acabou, o
   * próximo dia com jogos. Nunca fica vazio à toa e ajuda a achar o que falta
   * palpitar. Os cards são "espelhos" dos de baixo (mesmo match_id, sincronizados).
   *
   * @returns {string} Section HTML (or "" when nothing's left) / HTML da seção.
   */
  function buildTodaySection() {
    const open = MATCHES.filter((m) => !isLocked(m))
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    if (!open.length) return ""; // Copa acabou / nothing left to predict

    const todayStr = brDay(new Date());
    const todays = open.filter((m) => brDay(new Date(m.kickoff)) === todayStr);
    let games, title;
    if (todays.length) {
      games = todays;
      title = "Jogos de hoje";
    } else {
      const nextDay = brDay(new Date(open[0].kickoff));
      games = open.filter((m) => brDay(new Date(m.kickoff)) === nextDay);
      title = "Próximos jogos";
    }
    // isToday=true: sem botão de escalação (evita id duplicado na página).
    return `<section class="phase phase--today" data-phase="today">
      <header class="phase__head">
        <h2><i class="ti ti-calendar-event" aria-hidden="true"></i> ${title}</h2>
        <span class="phase__mult">palpite rápido</span>
      </header>
      ${games.map((m) => buildCard(m, true)).join("")}
    </section>`;
  }

  /**
   * Builds a phase section (chronological, with a day header per Brasília date).
   * Monta a seção de uma fase (cronológica, com cabeçalho por dia em Brasília).
   *
   * @param {string} phase - Phase key / Chave da fase.
   * @returns {string} Section HTML (or "" if empty) / HTML da seção (ou "").
   */
  function buildPhaseSection(phase) {
    const games = MATCHES.filter((m) => m.phase === phase)
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)); // ordem cronológica
    if (!games.length) return "";
    const mult = PHASES[phase].multiplier;
    const multLabel = mult ? String(mult).replace(".", ",") + "x" : "—";

    // Jogos em sequência cronológica, com um cabeçalho por dia (Brasília).
    let body = "", lastDay = "";
    for (const m of games) {
      const day = dayLabelBR(m);
      if (day !== lastDay) { body += `<h3 class="day-title">${day}</h3>`; lastDay = day; }
      body += buildCard(m);
    }

    return `<section class="phase" data-phase="${phase}">
      <header class="phase__head">
        <h2>${PHASES[phase].name}</h2>
        <span class="phase__mult">multiplicador ${multLabel}</span>
      </header>
      ${body}
    </section>`;
  }

  /**
   * Day label (no time) in Brasília time, for the day header.
   * Rótulo do dia (sem hora) em horário de Brasília, para o cabeçalho do dia.
   *
   * @param {Object} m - The match / O jogo.
   * @returns {string}
   */
  function dayLabelBR(m) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long", day: "2-digit", month: "long",
    }).format(new Date(m.kickoff));
  }

  /**
   * Builds one match card (info, teams + score inputs, optional advancement,
   * status footer, and the lineup controls unless it's a "today" mirror card).
   * Monta um card de jogo (info, times + inputs de placar, avanço opcional,
   * rodapé de status e os controles de escalação, exceto no card "espelho" de hoje).
   *
   * @param {Object} m - The match / O jogo.
   * @param {boolean} [isToday] - Is it the "today" mirror card? / É o card-espelho de hoje?
   * @returns {string} Card HTML / HTML do card.
   */
  function buildCard(m, isToday) {
    const locked = isLocked(m);
    const pred = Storage.getPrediction(m.id) || {};
    const hv = pred.home ?? "";
    const av = pred.away ?? "";
    const dis = locked ? "disabled" : "";
    return `<article class="match ${locked ? "is-locked" : ""}" data-id="${m.id}">
      <div class="match__info">
        <span class="match__when">${formatKickoffBR(m)}</span>
        ${m.group ? `<span class="match__group">Grupo ${m.group}</span>` : ""}
        <span class="match__venue">${m.venue}</span>
      </div>
      <div class="match__row">
        <span class="team team--home">
          <span class="team__flag">${flagOf(m.home)}</span>
          <span class="team__name">${m.home}</span>
        </span>
        <span class="match__scores">
          <input class="score" type="number" min="0" max="99" inputmode="numeric"
                 data-id="${m.id}" data-side="home" value="${hv}" ${dis} aria-label="Gols ${m.home}">
          <span class="score__x">×</span>
          <input class="score" type="number" min="0" max="99" inputmode="numeric"
                 data-id="${m.id}" data-side="away" value="${av}" ${dis} aria-label="Gols ${m.away}">
        </span>
        <span class="team team--away">
          <span class="team__name">${m.away}</span>
          <span class="team__flag">${flagOf(m.away)}</span>
        </span>
      </div>
      ${ADVANCE_PHASES.has(m.phase) ? buildAdvance(m, pred, locked) : ""}
      <div class="match__foot">
        <span class="status ${locked ? "status--locked" : "status--open"}" data-cd="${m.id}">${locked ? '<i class="ti ti-lock" aria-hidden="true"></i> Fechado' : ""}</span>
        <span class="saved" data-saved="${m.id}"></span>
      </div>
      ${isToday ? "" : lineupControls(m)}
    </article>`;
  }

  /**
   * ESPN only publishes lineups near kickoff; show the button from ~3h before
   * (covers matches about to start and already-played ones).
   * A ESPN só libera escalação perto do início; mostra o botão a partir de ~3h
   * antes (cobre jogos prestes a começar e os já realizados).
   *
   * @param {Object} m - The match / O jogo.
   * @returns {boolean}
   */
  function lineupLikely(m) {
    return Date.now() >= kickoffDate(m).getTime() - 3 * 3600 * 1000;
  }

  /**
   * Lineup button + empty box; lineup.js handles the rest (lazy load).
   * Botão + caixa (vazia) das escalações; o lineup.js cuida do resto (lazy).
   *
   * @param {Object} m - The match / O jogo.
   * @returns {string} Controls HTML (or "" when too early) / HTML (ou "" se cedo demais).
   */
  function lineupControls(m) {
    if (!lineupLikely(m)) return "";
    return `<div class="lineup-wrap">
      <button type="button" class="lineup-btn" data-lineup="${m.id}" aria-expanded="false"><i class="ti ti-soccer-field" aria-hidden="true"></i> Escalações</button>
      <div class="lineup-box" data-lineup-box="${m.id}" hidden></div>
    </div>`;
  }

  /**
   * "Who advances" picker for knockout matches.
   * Seletor "quem avança" para jogos de mata-mata.
   *
   * @param {Object} m - The match / O jogo.
   * @param {Object} pred - The saved prediction / O palpite salvo.
   * @param {boolean} locked - Is the match locked? / O jogo está travado?
   * @returns {string} Picker HTML / HTML do seletor.
   */
  function buildAdvance(m, pred, locked) {
    const sel = pred.advances || "";
    const dis = locked ? "disabled" : "";
    return `<div class="advance">
      <span class="advance__label">Quem avança?</span>
      <div class="advance__opts">
        <button type="button" class="advance__btn ${sel === "home" ? "is-on" : ""}" data-adv="home" data-id="${m.id}" ${dis}>${flagOf(m.home)} ${m.home}</button>
        <button type="button" class="advance__btn ${sel === "away" ? "is-on" : ""}" data-adv="away" data-id="${m.id}" ${dis}>${flagOf(m.away)} ${m.away}</button>
      </div>
    </div>`;
  }

  // ---- Interação / interaction ----

  /**
   * Binds the change handler to every score input.
   * Liga o handler de change a todos os inputs de placar.
   *
   * @returns {void}
   */
  function attachScoreHandlers() {
    document.querySelectorAll(".score").forEach((input) => {
      input.addEventListener("change", onScoreChange);
    });
  }

  /**
   * On score change: saves the prediction (only when both sides are filled) and
   * mirrors it to every card of the same match.
   * No change do placar: salva o palpite (só com os dois lados preenchidos) e
   * espelha em todos os cards do mesmo jogo.
   *
   * @param {Event} e - The change event / O evento de change.
   * @returns {void}
   */
  function onScoreChange(e) {
    const id = Number(e.target.dataset.id);
    const card = e.target.closest(".match"); // o card realmente editado
    const home = card.querySelector('[data-side="home"]').value;
    const away = card.querySelector('[data-side="away"]').value;
    if (home === "" || away === "") return; // só salva placar completo
    const ok = Storage.savePrediction(id, clampScore(home), clampScore(away));
    syncPrediction(id, ok); // espelha em TODOS os cards do mesmo jogo
  }

  /**
   * A match can have 2 cards (the "today" shortcut + the list). Keeps both in
   * sync, always writing to the same match_id — never a duplicate prediction.
   * Um jogo pode ter 2 cards (atalho "hoje" + lista). Mantém os dois iguais,
   * gravando sempre no mesmo match_id — nunca palpite duplicado.
   *
   * @param {number} id - Match id / Id do jogo.
   * @param {boolean} ok - Whether the save succeeded / Se o salvamento deu certo.
   * @returns {void}
   */
  function syncPrediction(id, ok) {
    const pred = Storage.getPrediction(id) || {};
    document.querySelectorAll(`.match[data-id="${id}"]`).forEach((card) => {
      const hi = card.querySelector('[data-side="home"]');
      const ai = card.querySelector('[data-side="away"]');
      if (hi && pred.home != null) hi.value = pred.home;
      if (ai && pred.away != null) ai.value = pred.away;
      setSaved(card, ok);
    });
  }

  /**
   * Updates a card's "salvo/erro" tag.
   * Atualiza a etiqueta "salvo/erro" de um card.
   *
   * @param {HTMLElement} card - The match card / O card do jogo.
   * @param {boolean} ok - Whether the save succeeded / Se o salvamento deu certo.
   * @returns {void}
   */
  function setSaved(card, ok) {
    const tag = card.querySelector("[data-saved]");
    if (!tag) return;
    tag.innerHTML = ok ? 'salvo <i class="ti ti-check" aria-hidden="true"></i>' : "erro ao salvar";
    tag.classList.toggle("saved--ok", ok);
  }

  /**
   * Clamps a raw score input into the valid range [0, 99].
   * Limita um placar digitado ao intervalo válido [0, 99].
   *
   * @param {string|number} value - Raw input / Valor digitado.
   * @returns {number}
   */
  function clampScore(value) {
    let n = parseInt(value, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 99) n = 99;
    return n;
  }

  /**
   * Binds the click handler to every "who advances" button.
   * Liga o handler de clique a todos os botões de "quem avança".
   *
   * @returns {void}
   */
  function attachAdvanceHandlers() {
    document.querySelectorAll(".advance__btn").forEach((btn) => {
      btn.addEventListener("click", onAdvanceClick);
    });
  }

  /**
   * On advancement click: saves the pick and mirrors the selected state across
   * every card of the same match.
   * No clique de avanço: salva o palpite e espelha o estado selecionado em todos
   * os cards do mesmo jogo.
   *
   * @param {Event} e - The click event / O evento de clique.
   * @returns {void}
   */
  function onAdvanceClick(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    const id = Number(btn.dataset.id);
    const side = btn.dataset.adv;
    const ok = Storage.saveAdvance(id, side);
    document.querySelectorAll(`.match[data-id="${id}"]`).forEach((card) => {
      card.querySelectorAll(".advance__btn").forEach((x) =>
        x.classList.toggle("is-on", x.dataset.adv === side && ok));
      setSaved(card, ok);
    });
  }

  /**
   * Registers a countdown only for matches still open.
   * Registra o contador só nos jogos ainda abertos.
   *
   * @returns {void}
   */
  function registerCountdowns() {
    MATCHES.forEach((m) => {
      if (isLocked(m)) return;
      document.querySelectorAll(`[data-cd="${m.id}"]`).forEach((el) => Countdown.register(el, m, lockCard));
    });
  }

  /**
   * Locks a match's card(s): disables inputs and shows the "Fechado" status.
   * Called live by the countdown when the ball rolls.
   * Trava o(s) card(s) de um jogo: desabilita os inputs e mostra "Fechado".
   * Chamado ao vivo pelo contador quando a bola rola.
   *
   * @param {Object} m - The match / O jogo.
   * @returns {void}
   */
  function lockCard(m) {
    document.querySelectorAll(`.match[data-id="${m.id}"]`).forEach((card) => {
      card.classList.add("is-locked");
      card.querySelectorAll(".score").forEach((i) => (i.disabled = true));
      card.querySelectorAll(".advance__btn").forEach((b) => (b.disabled = true));
      const status = card.querySelector("[data-cd]");
      if (status) { status.className = "status status--locked"; status.innerHTML = '<i class="ti ti-lock" aria-hidden="true"></i> Fechado'; }
    });
  }

  /**
   * Re-locks EVERY started match. Called when the page returns to the
   * foreground: on mobile the setInterval freezes in the background, so without
   * this a match could stay editable for an instant when reopening the tab. The
   * bonus is re-rendered too if it just locked.
   * Revalida TODAS as travas. Chamado quando a página volta ao 1º plano: no
   * celular o contador (setInterval) congela em 2º plano, então sem isto um jogo
   * podia ficar editável por um instante ao reabrir a aba. O bônus também trava.
   *
   * @returns {void}
   */
  function revalidateLocks() {
    MATCHES.forEach((m) => { if (isLocked(m)) lockCard(m); });
    const top = document.getElementById("bonusTopScorer");
    if (bonusLocked() && top && !top.disabled) renderBonus(); // o bônus também trava
  }

  // ---- Phase filter / filtro por fase ----

  /**
   * Wires the phase filter bar: shows only the chosen phase (or all).
   * Liga a barra de filtro por fase: mostra só a fase escolhida (ou todas).
   *
   * @returns {void}
   */
  function setupFilter() {
    const bar = document.getElementById("phaseFilter");
    if (!bar) return;
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const filter = btn.dataset.filter;
      document.querySelectorAll(".phase").forEach((sec) => {
        sec.style.display = filter === "all" || sec.dataset.phase === filter ? "" : "none";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
