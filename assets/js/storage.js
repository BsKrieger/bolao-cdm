/**
 * @file Persistence layer / Camada de persistência.
 *
 * EN: Uses localStorage today. The whole UI talks ONLY to this module — never
 *     to localStorage directly. Swapping for a backend later stays local and
 *     simple: just reimplement these functions (e.g. fetch to an API).
 * PT-BR: Hoje usa localStorage. Toda a UI fala SÓ com este módulo — nunca com
 *        localStorage direto. Assim, trocar por um backend depois é local e
 *        simples: basta reimplementar estas funções (ex.: fetch para uma API).
 *
 * @author Bruno Krieger
 */
const Storage = (() => {
  /** localStorage keys / chaves do localStorage. */
  const KEYS = {
    profile: "bolaocdm:profile",
    predictions: "bolaocdm:predictions",
    bonus: "bolaocdm:bonus",
  };

  /**
   * Safe read: never breaks the page on corrupt data.
   * Leitura segura: nunca quebra a página por dado corrompido.
   *
   * @param {string} key - Storage key / Chave do storage.
   * @param {*} fallback - Value when missing/invalid / Valor quando ausente/inválido.
   * @returns {*} Parsed value or fallback / Valor lido ou o fallback.
   */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("[storage] falha ao ler", key, err);
      return fallback;
    }
  }

  /**
   * Safe write: returns false if the browser blocks it (private mode/quota).
   * Escrita segura: retorna false se o navegador bloquear (modo privado/quota).
   *
   * @param {string} key - Storage key / Chave do storage.
   * @param {*} value - JSON-serializable value / Valor serializável em JSON.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("[storage] falha ao salvar", key, err);
      return false;
    }
  }

  // ---- Background sync with the backend / sincronização (fire-and-forget) ----

  /**
   * Current participant id, or null when running fully local.
   * Id do participante atual, ou null quando 100% local.
   *
   * @returns {string|number|null}
   */
  function remoteId() {
    const p = getProfile();
    return p && p.id ? p.id : null;
  }

  /**
   * Pushes one prediction to the backend (best-effort, never throws).
   * Envia um palpite ao backend (best-effort, nunca lança erro).
   *
   * @param {number} matchId - Match id / Id do jogo.
   * @param {Object} entry - Prediction entry / Entrada do palpite.
   * @returns {void}
   */
  function syncPrediction(matchId, entry) {
    const id = remoteId();
    if (typeof DB !== "undefined" && DB.ready() && id) {
      DB.pushPrediction(id, matchId, entry).catch((e) => console.warn("[sync] palpite", e.message));
    }
  }

  /**
   * Pushes the bonus picks to the backend (best-effort, never throws).
   * Envia os palpites bônus ao backend (best-effort, nunca lança erro).
   *
   * @param {Object} bonus - Bonus picks / Palpites bônus.
   * @returns {void}
   */
  function syncBonus(bonus) {
    const id = remoteId();
    if (typeof DB !== "undefined" && DB.ready() && id) {
      DB.pushBonus(id, bonus).catch((e) => console.warn("[sync] bônus", e.message));
    }
  }

  // ---- Participant profile / perfil do participante ----

  /**
   * Reads the saved profile.
   * Lê o perfil salvo.
   *
   * @returns {Object|null} Profile or null / Perfil ou null.
   */
  function getProfile() { return read(KEYS.profile, null); }

  /**
   * Saves (or clears, with null) the profile.
   * Salva (ou limpa, com null) o perfil.
   *
   * @param {Object|null} profile - Profile to store / Perfil a guardar.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function saveProfile(profile) { return write(KEYS.profile, profile); }

  // ---- Score predictions / palpites de placar ----
  // Format / Formato: { [matchId]: { home: Number, away: Number, ts: ISOString } }

  /**
   * All predictions keyed by match id.
   * Todos os palpites indexados por id de jogo.
   *
   * @returns {Object<number, Object>}
   */
  function getPredictions() { return read(KEYS.predictions, {}); }

  /**
   * One prediction by match id.
   * Um palpite pelo id do jogo.
   *
   * @param {number} matchId - Match id / Id do jogo.
   * @returns {Object|null}
   */
  function getPrediction(matchId) { return getPredictions()[matchId] || null; }

  /**
   * Saves a score prediction and triggers a background sync.
   * Salva um palpite de placar e dispara a sincronização em segundo plano.
   *
   * @param {number} matchId - Match id / Id do jogo.
   * @param {number} home - Home goals / Gols do mandante.
   * @param {number} away - Away goals / Gols do visitante.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function savePrediction(matchId, home, away) {
    const all = getPredictions();
    all[matchId] = { ...(all[matchId] || {}), home, away, ts: new Date().toISOString() };
    const ok = write(KEYS.predictions, all);
    syncPrediction(matchId, all[matchId]);
    return ok;
  }

  /**
   * Saves the knockout "who advances" pick for a match.
   * Salva o palpite de "quem avança" no mata-mata.
   *
   * @param {number} matchId - Match id / Id do jogo.
   * @param {"home"|"away"} side - Chosen side / Lado escolhido.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function saveAdvance(matchId, side) {
    const all = getPredictions();
    all[matchId] = { ...(all[matchId] || {}), advances: side, ts: new Date().toISOString() };
    const ok = write(KEYS.predictions, all);
    syncPrediction(matchId, all[matchId]);
    return ok;
  }

  /**
   * Replaces the whole local cache (used when pulling from the backend).
   * Substitui todo o cache local (usado ao puxar do backend).
   *
   * @param {Object<number, Object>} map - Predictions map / Mapa de palpites.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function setAllPredictions(map) { return write(KEYS.predictions, map || {}); }

  // ---- Bonus picks (champion + top scorer) / palpites bônus ----

  /**
   * Reads the bonus picks.
   * Lê os palpites bônus.
   *
   * @returns {Object}
   */
  function getBonus() { return read(KEYS.bonus, {}); }

  /**
   * Merges and saves the bonus picks, then triggers a background sync.
   * Mescla e salva os palpites bônus e dispara a sincronização.
   *
   * @param {Object} bonus - Partial bonus to merge / Bônus parcial a mesclar.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function saveBonus(bonus) {
    const merged = { ...getBonus(), ...bonus, ts: new Date().toISOString() };
    const ok = write(KEYS.bonus, merged);
    syncBonus(merged);
    return ok;
  }

  /**
   * Replaces the bonus cache (used when pulling from the backend).
   * Substitui o cache do bônus (usado ao puxar do backend).
   *
   * @param {Object} bonus - Bonus to store / Bônus a guardar.
   * @returns {boolean} true on success / true em caso de sucesso.
   */
  function setBonus(bonus) { return write(KEYS.bonus, bonus || {}); }

  return {
    KEYS,
    getProfile, saveProfile,
    getPredictions, getPrediction, savePrediction, saveAdvance, setAllPredictions,
    getBonus, saveBonus, setBonus,
  };
})();
