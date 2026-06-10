/* =========================================================================
   Camada de persistência / Persistence layer
   ---------------------------------------------------------------------------
   Hoje usa localStorage. Toda a UI fala SÓ com este módulo — nunca com
   localStorage direto. Assim, trocar por um backend depois é local e simples:
   basta reimplementar estas funções (ex: fetch para uma API).
   ========================================================================= */
const Storage = (() => {
  const KEYS = {
    profile: "bolaocdm:profile",
    predictions: "bolaocdm:predictions",
    bonus: "bolaocdm:bonus",
  };

  // Leitura segura: nunca quebra a página por dado corrompido / read safely.
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("[storage] falha ao ler", key, err);
      return fallback;
    }
  }

  // Escrita segura: retorna false se o navegador bloquear (modo privado/quota).
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("[storage] falha ao salvar", key, err);
      return false;
    }
  }

  // ---- Sincronização com o backend (fire-and-forget) / background sync ----
  function remoteId() {
    const p = getProfile();
    return p && p.id ? p.id : null;
  }
  function syncPrediction(matchId, entry) {
    const id = remoteId();
    if (typeof DB !== "undefined" && DB.ready() && id) {
      DB.pushPrediction(id, matchId, entry).catch((e) => console.warn("[sync] palpite", e.message));
    }
  }
  function syncBonus(bonus) {
    const id = remoteId();
    if (typeof DB !== "undefined" && DB.ready() && id) {
      DB.pushBonus(id, bonus).catch((e) => console.warn("[sync] bônus", e.message));
    }
  }

  // ---- Perfil do participante / participant profile ----
  function getProfile() { return read(KEYS.profile, null); }
  function saveProfile(profile) { return write(KEYS.profile, profile); }

  // ---- Palpites de placar / score predictions ----
  // Formato: { [matchId]: { home: Number, away: Number, ts: ISOString } }
  function getPredictions() { return read(KEYS.predictions, {}); }
  function getPrediction(matchId) { return getPredictions()[matchId] || null; }
  function savePrediction(matchId, home, away) {
    const all = getPredictions();
    all[matchId] = { ...(all[matchId] || {}), home, away, ts: new Date().toISOString() };
    const ok = write(KEYS.predictions, all);
    syncPrediction(matchId, all[matchId]);
    return ok;
  }

  // Palpite de quem avança no mata-mata / knockout advancement pick.
  function saveAdvance(matchId, side) {
    const all = getPredictions();
    all[matchId] = { ...(all[matchId] || {}), advances: side, ts: new Date().toISOString() };
    const ok = write(KEYS.predictions, all);
    syncPrediction(matchId, all[matchId]);
    return ok;
  }

  // Substitui todo o cache local (usado ao puxar do backend) / replace local cache.
  function setAllPredictions(map) { return write(KEYS.predictions, map || {}); }

  // ---- Palpites bônus (campeã + artilheiro) / bonus picks ----
  function getBonus() { return read(KEYS.bonus, {}); }
  function saveBonus(bonus) {
    const merged = { ...getBonus(), ...bonus, ts: new Date().toISOString() };
    const ok = write(KEYS.bonus, merged);
    syncBonus(merged);
    return ok;
  }
  function setBonus(bonus) { return write(KEYS.bonus, bonus || {}); }

  return {
    KEYS,
    getProfile, saveProfile,
    getPredictions, getPrediction, savePrediction, saveAdvance, setAllPredictions,
    getBonus, saveBonus, setBonus,
  };
})();
