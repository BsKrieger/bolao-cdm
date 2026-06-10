/* =========================================================================
   Tela de Jogos & Palpites / Matches & predictions screen
   - Lista os 104 jogos por fase (grupos subdivididos por grupo)
   - Campos de palpite com salvamento automático
   - Countdown por jogo e trava automática quando a bola rola
   ========================================================================= */
(function () {
  const PHASE_ORDER = ["group", "r32", "r16", "qf", "sf", "third", "final"];
  const ADVANCE_PHASES = new Set(["r32", "r16", "qf", "sf"]); // fases com "quem avança"

  function init() { App.requireProfile(start); }

  function start() {
    const root = document.getElementById("matchesRoot");
    root.innerHTML = PHASE_ORDER.map(buildPhaseSection).join("");
    renderBonus();
    scheduleBonusAutoLock();
    attachScoreHandlers();
    attachAdvanceHandlers();
    registerCountdowns();
    setupFilter();
    Countdown.tick(); // primeira atualização imediata
  }

  // ---- Palpites bônus (campeã + artilheiro) / bonus picks ----

  // A Copa "começou" no horário do primeiro jogo / tournament start = first kickoff.
  function firstKickoff() {
    return Math.min(...MATCHES.map((m) => new Date(m.kickoff).getTime()));
  }

  function bonusLocked() {
    return Date.now() >= firstKickoff();
  }

  // Trava ao vivo: se a página ficar aberta, re-renderiza o bônus (já travado)
  // exatamente quando a bola rolar no 1º jogo. / live auto-lock at first kickoff.
  function scheduleBonusAutoLock() {
    if (bonusLocked()) return;
    const remaining = firstKickoff() - Date.now();
    const MAX_TIMEOUT = 2147483647; // ~24,8 dias: limite do setTimeout (evita overflow)
    if (remaining <= 0 || remaining > MAX_TIMEOUT) return;
    setTimeout(renderBonus, remaining + 500); // +0,5s p/ garantir que já passou do kickoff
  }

  // Escapa texto para uso seguro em HTML / escape text for safe HTML.
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Monta os <optgroup>/<option> do artilheiro a partir de SCORERS.
  // Agrupa por país (PT) e marca o jogador já escolhido. / build top-scorer options.
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

  function renderBonus() {
    const root = document.getElementById("bonusRoot");
    if (!root) return;
    const bonus = Storage.getBonus();
    const locked = bonusLocked();
    const dis = locked ? "disabled" : "";
    const teams = Object.keys(TEAMS).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const opts = teams.map((t) =>
      `<button type="button" class="cselect__opt" data-val="${t}">${flagOf(t)} <span>${t}</span></button>`).join("");
    const btnLabel = bonus.champion
      ? `${flagOf(bonus.champion)} ${bonus.champion}`
      : `<span class="cselect__ph">— escolha a seleção —</span>`;
    root.innerHTML = `
      <h2 class="section__title">Palpites bônus</h2>
      <p class="bonus__note">${locked
        ? "🔒 Fechado — a Copa já começou."
        : "Valem no fim da Copa: campeã 20 pts · artilheiro 15 pts. Travam quando a bola rolar no 1º jogo."}</p>
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
      <span class="saved" id="bonusSaved"></span>`;
    if (!locked) attachBonusHandlers();
  }

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

  function saveBonusNow() {
    const sel = document.getElementById("championSelect");
    const champion = sel ? (sel.dataset.value || "") : "";
    const topScorer = ((document.getElementById("bonusTopScorer") || {}).value || "").trim();
    const ok = Storage.saveBonus({ champion, topScorer });
    const tag = document.getElementById("bonusSaved");
    if (tag) {
      tag.textContent = ok ? "salvo ✓" : "erro ao salvar";
      tag.classList.toggle("saved--ok", ok);
    }
  }

  // ---- Construção do HTML / HTML building ----

  function buildPhaseSection(phase) {
    const games = MATCHES.filter((m) => m.phase === phase);
    if (!games.length) return "";
    const mult = PHASES[phase].multiplier;
    const multLabel = mult ? String(mult).replace(".", ",") + "x" : "—";

    let body;
    if (phase === "group") {
      const letters = [...new Set(games.map((g) => g.group))];
      body = letters.map((letter) => {
        const inGroup = games.filter((g) => g.group === letter);
        return `<h3 class="group-title">Grupo ${letter}</h3>` + inGroup.map(buildCard).join("");
      }).join("");
    } else {
      body = games.map(buildCard).join("");
    }

    return `<section class="phase" data-phase="${phase}">
      <header class="phase__head">
        <h2>${PHASES[phase].name}</h2>
        <span class="phase__mult">multiplicador ${multLabel}</span>
      </header>
      ${body}
    </section>`;
  }

  function buildCard(m) {
    const locked = isLocked(m);
    const pred = Storage.getPrediction(m.id) || {};
    const hv = pred.home ?? "";
    const av = pred.away ?? "";
    const dis = locked ? "disabled" : "";
    return `<article class="match ${locked ? "is-locked" : ""}" data-id="${m.id}">
      <div class="match__info">
        <span class="match__when">${formatKickoffBR(m)}</span>
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
        <span class="status ${locked ? "status--locked" : "status--open"}" data-cd="${m.id}">${locked ? "🔒 Fechado" : ""}</span>
        <span class="saved" data-saved="${m.id}"></span>
      </div>
    </article>`;
  }

  // Seletor "quem avança" para jogos de mata-mata / knockout advancement picker.
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

  function attachScoreHandlers() {
    document.querySelectorAll(".score").forEach((input) => {
      input.addEventListener("change", onScoreChange);
    });
  }

  function onScoreChange(e) {
    const id = Number(e.target.dataset.id);
    const card = document.querySelector(`.match[data-id="${id}"]`);
    const home = card.querySelector('[data-side="home"]').value;
    const away = card.querySelector('[data-side="away"]').value;
    if (home === "" || away === "") return; // só salva placar completo
    const ok = Storage.savePrediction(id, clampScore(home), clampScore(away));
    const tag = card.querySelector(`[data-saved="${id}"]`);
    if (tag) {
      tag.textContent = ok ? "salvo ✓" : "erro ao salvar";
      tag.classList.toggle("saved--ok", ok);
    }
  }

  function clampScore(value) {
    let n = parseInt(value, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 99) n = 99;
    return n;
  }

  function attachAdvanceHandlers() {
    document.querySelectorAll(".advance__btn").forEach((btn) => {
      btn.addEventListener("click", onAdvanceClick);
    });
  }

  function onAdvanceClick(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    const id = Number(btn.dataset.id);
    const side = btn.dataset.adv;
    const ok = Storage.saveAdvance(id, side);
    const card = document.querySelector(`.match[data-id="${id}"]`);
    card.querySelectorAll(".advance__btn").forEach((x) =>
      x.classList.toggle("is-on", x.dataset.adv === side && ok)
    );
    const tag = card.querySelector(`[data-saved="${id}"]`);
    if (tag) {
      tag.textContent = ok ? "salvo ✓" : "erro ao salvar";
      tag.classList.toggle("saved--ok", ok);
    }
  }

  // Registra countdown só nos jogos ainda abertos / only open matches.
  function registerCountdowns() {
    MATCHES.forEach((m) => {
      if (isLocked(m)) return;
      const el = document.querySelector(`[data-cd="${m.id}"]`);
      if (el) Countdown.register(el, m, lockCard);
    });
  }

  // Chamado ao vivo quando o jogo começa / called live when a match starts.
  function lockCard(m) {
    const card = document.querySelector(`.match[data-id="${m.id}"]`);
    if (!card) return;
    card.classList.add("is-locked");
    card.querySelectorAll(".score").forEach((i) => (i.disabled = true));
    card.querySelectorAll(".advance__btn").forEach((b) => (b.disabled = true));
    const status = card.querySelector(`[data-cd="${m.id}"]`);
    if (status) status.className = "status status--locked";
  }

  // ---- Filtro por fase / phase filter ----
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
