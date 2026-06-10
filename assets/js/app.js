/* =========================================================================
   Inicialização comum / Shared app logic
   - Helpers de exibição (bandeira, data em Brasília, trava por horário)
   - Perfil do participante: cadastro no 1º acesso + edição
   ========================================================================= */

// ---- Helpers de exibição (globais) / display helpers (global) ----

// Código ISO da seleção / ISO code of the team.
function flagCode(team) {
  return (typeof TEAMS !== "undefined" && TEAMS[team]) ? TEAMS[team] : "";
}

// HTML da bandeira (imagem). Vazio para slots de mata-mata (ex: "1º A").
// Usa imagens (flagcdn.com) porque emojis de bandeira não renderizam no Windows.
function flagOf(team) {
  const code = flagCode(team);
  return code
    ? `<img class="flag" src="https://flagcdn.com/${code}.svg" alt="" loading="lazy">`
    : "";
}

function kickoffDate(match) { return new Date(match.kickoff); }

// Jogo travado = a bola já rolou (agora >= horário de início).
function isLocked(match, now = Date.now()) {
  return now >= kickoffDate(match).getTime();
}

// Data/hora SEMPRE em horário de Brasília, qualquer que seja o fuso do visitante.
function formatKickoffBR(match) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(kickoffDate(match));
}

// ---- Perfil + cadastro (nome + código) / profile + sign-up (name + code) ----
const App = (() => {
  const backendOn = (typeof DB !== "undefined" && DB.ready());

  // Garante que existe um perfil antes de iniciar a página.
  function requireProfile(onReady) {
    const profile = Storage.getProfile();
    if (profile && profile.name) {
      renderProfileChip(profile);
      syncOnLoad(profile).then(() => onReady(profile));
      return;
    }
    openProfileModal(onReady);
  }

  // Puxa os palpites do participante do backend para o cache local / pull from backend.
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

  // Resultados do banco com fallback para results.js / results from DB with fallback.
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

  // Mostra o nome no cabeçalho; clique permite trocar de participante (logout).
  function renderProfileChip(profile) {
    const chip = document.getElementById("profileChip");
    if (!chip) return;
    chip.textContent = "👤 " + profile.name;
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

  function modalMarkup() {
    const codeField = backendOn ? `
        <input id="profileCodeInput" class="modal__input" type="text" maxlength="20"
               placeholder="Código pessoal (ex: 1234)" autocomplete="off" style="margin-top:10px;" />` : "";
    const help = backendOn
      ? "Escolha seu nome e um código pessoal. Com eles você acessa e edita seus palpites de qualquer aparelho."
      : "Escolha o nome que vai aparecer no ranking. Fica salvo neste aparelho.";
    return `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Cadastro de participante">
        <img class="modal__logo" src="assets/img/logo-cdm.png" alt="" />
        <h2 class="modal__title">Bem-vindo ao Bolão CDM</h2>
        <p class="modal__text">${help}</p>
        <input id="profileNameInput" class="modal__input" type="text" maxlength="24"
               placeholder="Seu nome" autocomplete="off" />
        ${codeField}
        <p class="modal__error" id="profileError"></p>
        <button class="btn btn--primary modal__save" id="profileSave">Começar</button>
      </div>`;
  }

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
        if (code.length < 3) { error.textContent = "Crie um código pessoal de pelo menos 3 caracteres."; return; }
        saveBtn.disabled = true;
        error.textContent = "Entrando…";
        try {
          const res = await DB.loginOrRegister(name, code);
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

  function finish(profile, onReady, overlay) {
    document.body.removeChild(overlay);
    renderProfileChip(profile);
    if (onReady) onReady(profile);
  }

  return { requireProfile, openProfileModal, renderProfileChip, loadResults };
})();
