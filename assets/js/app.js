/**
 * @file Shared app logic / Inicialização comum.
 *
 * EN: Global display helpers (flag, Brasília date, time-based lock, HTML escape,
 *     points format) plus the participant profile (first-access sign-up + edit).
 * PT-BR: Helpers de exibição globais (bandeira, data em Brasília, trava por
 *        horário, escape de HTML, formato de pontos) e o perfil do participante
 *        (cadastro no 1º acesso + edição).
 *
 * @author Bruno Krieger
 */

// ---- Global display helpers / helpers de exibição (globais) ----

/**
 * ISO code of a team (empty for knockout placeholder slots like "1º A").
 * Código ISO da seleção (vazio para slots de mata-mata, ex.: "1º A").
 *
 * @param {string} team - Team name / Nome da seleção.
 * @returns {string} ISO code or "" / Código ISO ou "".
 */
function flagCode(team) {
  return (typeof TEAMS !== "undefined" && TEAMS[team]) ? TEAMS[team] : "";
}

/**
 * Flag image markup. Uses images (flagcdn.com) because flag emojis don't render
 * on Windows. Empty for placeholder slots.
 * HTML da bandeira (imagem). Usa imagens (flagcdn.com) porque emojis de bandeira
 * não renderizam no Windows. Vazio para slots de mata-mata.
 *
 * @param {string} team - Team name / Nome da seleção.
 * @returns {string} <img> HTML or "" / HTML do <img> ou "".
 */
function flagOf(team) {
  const code = flagCode(team);
  return code
    ? `<img class="flag" src="https://flagcdn.com/${code}.svg" alt="" loading="lazy">`
    : "";
}

/**
 * Parses a match kickoff into a Date.
 * Converte o kickoff de um jogo em Date.
 *
 * @param {{kickoff:string}} match - The match / O jogo.
 * @returns {Date}
 */
function kickoffDate(match) { return new Date(match.kickoff); }

/**
 * Whether the match is locked (the ball has rolled: now >= kickoff).
 * Se o jogo está travado (a bola já rolou: agora >= horário de início).
 *
 * @param {{kickoff:string}} match - The match / O jogo.
 * @param {number} [now=Date.now()] - Reference time / Horário de referência.
 * @returns {boolean}
 */
function isLocked(match, now = Date.now()) {
  return now >= kickoffDate(match).getTime();
}

/**
 * Date/time ALWAYS in Brasília time, regardless of the visitor's timezone.
 * Data/hora SEMPRE em horário de Brasília, qualquer que seja o fuso do visitante.
 *
 * @param {{kickoff:string}} match - The match / O jogo.
 * @returns {string} Localized label / Rótulo localizado.
 */
function formatKickoffBR(match) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(kickoffDate(match));
}

/**
 * Escapes text for safe HTML interpolation (user/DB-sourced data). Single source
 * used by every screen.
 * Escapa texto para interpolar em HTML com segurança (dados do usuário/banco).
 * Fonte única usada por todas as telas.
 *
 * @param {*} s - Value to escape / Valor a escapar.
 * @returns {string} Escaped string / String escapada.
 */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Formats points with up to 2 decimals and a comma separator (pt-BR).
 * Pontos com até 2 casas e vírgula decimal (pt-BR).
 *
 * @param {number} n - Points / Pontos.
 * @returns {string}
 */
function fmtPts(n) {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

// ---- Profile + sign-up (name + code) / perfil + cadastro (nome + código) ----

/**
 * Shared app namespace (profile lifecycle, results loading).
 * Namespace comum do app (ciclo de vida do perfil, carregamento de resultados).
 *
 * @namespace App
 * @author Bruno Krieger
 */
const App = (() => {
  const backendOn = (typeof DB !== "undefined" && DB.ready());

  /**
   * Ensures a profile exists before starting the page; opens the modal if not.
   * Garante que existe um perfil antes de iniciar a página; abre o modal se não.
   *
   * @param {function(Object):void} onReady - Called with the profile / Chamado com o perfil.
   * @returns {void}
   */
  function requireProfile(onReady) {
    const profile = Storage.getProfile();
    if (profile && profile.name) {
      renderProfileChip(profile);
      syncOnLoad(profile).then(() => onReady(profile));
      return;
    }
    openProfileModal(onReady);
  }

  /**
   * Pulls the participant's predictions/bonus from the backend into the local
   * cache. No-op when local-only or without an id.
   * Puxa os palpites/bônus do participante do backend para o cache local.
   * Não faz nada no modo local ou sem id.
   *
   * @param {{id?:string|number}} profile - The profile / O perfil.
   * @returns {Promise<void>}
   */
  async function syncOnLoad(profile) {
    if (!backendOn || !profile.id) return;
    try {
      const [preds, bonus] = await Promise.all([
        DB.pullPredictions(profile.id),
        DB.pullBonus(profile.id),
      ]);
      Storage.setAllPredictions(preds);
      Storage.setBonus(bonus);
    } catch (e) {
      console.warn("[sync] carregar", e.message);
    }
  }

  /**
   * Loads results (and the tournament outcome) from the DB, falling back to the
   * static results.js when the backend is off or fails.
   * Carrega resultados (e o resultado do torneio) do banco, com fallback para o
   * results.js estático quando o backend está off ou falha.
   *
   * @returns {Promise<{res:Object, tr:?Object}>}
   */
  async function loadResults() {
    let res = (typeof RESULTS !== "undefined") ? RESULTS : {};
    let tr = (typeof TOURNAMENT_RESULT !== "undefined") ? TOURNAMENT_RESULT : null;
    if (backendOn) {
      try {
        const dbRes = await DB.fetchResults();
        if (dbRes && Object.keys(dbRes).length) res = dbRes;
      } catch (e) { console.warn("[results]", e.message); }
      try {
        const dbTr = await DB.fetchTournamentResult();
        if (dbTr) tr = dbTr;
      } catch (e) { console.warn("[tournament]", e.message); }
    }
    return { res, tr };
  }

  /**
   * Shows the name in the header; clicking it lets you switch participant
   * (logout). The name is rendered as a text node, never via innerHTML.
   * Mostra o nome no cabeçalho; clicar permite trocar de participante (logout).
   * O nome é inserido como nó de texto, nunca via innerHTML.
   *
   * @param {{name:string}} profile - The profile / O perfil.
   * @returns {void}
   */
  function renderProfileChip(profile) {
    const chip = document.getElementById("profileChip");
    if (!chip) return;
    chip.textContent = "";
    const _icon = document.createElement("i");
    _icon.className = "ti ti-user";
    _icon.setAttribute("aria-hidden", "true");
    chip.appendChild(_icon);
    chip.appendChild(document.createTextNode(" " + profile.name));
    chip.title = "Trocar de participante";
    chip.onclick = () => {
      if (!confirm("Sair e trocar de participante neste aparelho?")) return;
      Storage.saveProfile(null);
      try {
        localStorage.removeItem(Storage.KEYS.predictions);
        localStorage.removeItem(Storage.KEYS.bonus);
      } catch (e) { /* ignore */ }
      location.reload();
    };
  }

  /**
   * Builds the sign-up modal markup (the code field only when the backend is on).
   * Monta o HTML do modal de cadastro (o campo de código só com o backend ligado).
   *
   * @returns {string} Modal HTML / HTML do modal.
   */
  function modalMarkup() {
    const codeField = backendOn ? `
        <input id="profileCodeInput" class="modal__input" type="text" maxlength="20"
               placeholder="Seu código pessoal" autocomplete="off" style="margin-top:10px;" />` : "";
    const help = backendOn
      ? "Entre com o nome e o código que você já cadastrou. Errou? Confira com a organização — não criamos contas novas por aqui."
      : "Escolha o nome que vai aparecer no ranking. Fica salvo neste aparelho.";
    const btnLabel = backendOn ? "Entrar" : "Começar";
    return `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Acesso do participante">
        <img class="modal__logo" src="assets/img/logo-cdm.png" alt="" />
        <h2 class="modal__title">Bem-vindo ao Bolão CDM</h2>
        <p class="modal__text">${help}</p>
        <input id="profileNameInput" class="modal__input" type="text" maxlength="24"
               placeholder="Seu nome" autocomplete="off" />
        ${codeField}
        <p class="modal__error" id="profileError"></p>
        <button class="btn btn--primary modal__save" id="profileSave">${btnLabel}</button>
      </div>`;
  }

  /**
   * Opens the sign-up modal and wires the submit flow (login/register).
   * Abre o modal de cadastro e liga o fluxo de envio (login/cadastro).
   *
   * @param {function(Object):void} onReady - Called once the profile is set / Chamado quando o perfil é definido.
   * @returns {void}
   */
  function openProfileModal(onReady) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = modalMarkup();
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector("#profileNameInput");
    const codeInput = overlay.querySelector("#profileCodeInput");
    const error = overlay.querySelector("#profileError");
    const saveBtn = overlay.querySelector("#profileSave");
    nameInput.focus();

    async function submit() {
      const name = nameInput.value.trim();
      if (name.length < 2) { error.textContent = "Digite um nome com pelo menos 2 letras."; return; }

      if (backendOn) {
        const code = (codeInput.value || "").trim();
        if (!code) { error.textContent = "Digite seu código pessoal."; return; }
        saveBtn.disabled = true;
        error.textContent = "Entrando…";
        try {
          const res = await DB.login(name, code);
          if (!res.ok) { error.textContent = res.error; saveBtn.disabled = false; return; }
          const profile = { id: res.participant.id, name: res.participant.name, code };
          Storage.saveProfile(profile);
          await syncOnLoad(profile);
          finish(profile, onReady, overlay);
        } catch (e) {
          error.textContent = "Falha de conexão. Tente de novo.";
          saveBtn.disabled = false;
          console.warn("[cadastro]", e.message);
        }
      } else {
        const profile = { name, createdAt: new Date().toISOString() };
        Storage.saveProfile(profile);
        finish(profile, onReady, overlay);
      }
    }

    saveBtn.onclick = submit;
    overlay.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  /**
   * Removes the modal, shows the chip and hands control to the page.
   * Remove o modal, mostra o chip e devolve o controle para a página.
   *
   * @param {Object} profile - The profile / O perfil.
   * @param {function(Object):void} onReady - Page callback / Callback da página.
   * @param {HTMLElement} overlay - The modal overlay / O overlay do modal.
   * @returns {void}
   */
  function finish(profile, onReady, overlay) {
    document.body.removeChild(overlay);
    renderProfileChip(profile);
    if (onReady) onReady(profile);
  }

  return { requireProfile, openProfileModal, renderProfileChip, loadResults };
})();
