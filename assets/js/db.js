/* =========================================================================
   Adaptador do Supabase / Supabase data adapter
   ---------------------------------------------------------------------------
   Fala com a API REST (PostgREST) via fetch — sem biblioteca externa.
   Todas as funções são assíncronas (retornam Promise).
   Se CONFIG estiver vazio, DB.ready() é false e o app roda 100% local.
   ========================================================================= */
const DB = (() => {
  const URL = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL)
    ? CONFIG.SUPABASE_URL.replace(/\/+$/, "") : "";
  const KEY = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_KEY)
    ? CONFIG.SUPABASE_KEY : "";

  function ready() { return !!(URL && KEY); }

  function headers(extra) {
    return Object.assign(
      { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      extra || {}
    );
  }

  // Chamada REST genérica / generic REST call.
  async function rest(path, options) {
    const res = await fetch(URL + "/rest/v1/" + path, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("Supabase " + res.status + ": " + body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ---- Participantes / participants ----
  async function findParticipant(name) {
    const rows = await rest(
      "participants?select=*&name=eq." + encodeURIComponent(name),
      { headers: headers() }
    );
    return (rows && rows[0]) || null;
  }

  // Login (nome+código) ou cadastro no 1º acesso / login or first-time register.
  async function loginOrRegister(name, code) {
    const existing = await findParticipant(name);
    if (existing) {
      if (existing.code !== code) {
        return { ok: false, error: "Esse nome já está em uso e o código não confere." };
      }
      return { ok: true, participant: existing };
    }
    const created = await rest("participants", {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({ name, code }),
    });
    return { ok: true, participant: created[0] };
  }

  // ---- Palpites / predictions ----
  async function pullPredictions(participantId) {
    const rows = await rest(
      "predictions?select=*&participant_id=eq." + participantId,
      { headers: headers() }
    );
    const map = {};
    (rows || []).forEach((r) => {
      map[r.match_id] = { home: r.home, away: r.away, advances: r.advances };
    });
    return map;
  }

  async function pushPrediction(participantId, matchId, fields) {
    const body = {
      participant_id: participantId,
      match_id: Number(matchId),
      home: fields.home ?? null,
      away: fields.away ?? null,
      advances: fields.advances ?? null,
      updated_at: new Date().toISOString(),
    };
    await rest("predictions?on_conflict=participant_id,match_id", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(body),
    });
  }

  // ---- Bônus / bonus ----
  async function pullBonus(participantId) {
    const rows = await rest(
      "bonus?select=*&participant_id=eq." + participantId,
      { headers: headers() }
    );
    const b = rows && rows[0];
    return b ? { champion: b.champion, topScorer: b.top_scorer } : {};
  }

  async function pushBonus(participantId, fields) {
    const body = {
      participant_id: participantId,
      champion: fields.champion ?? null,
      top_scorer: fields.topScorer ?? null,
      updated_at: new Date().toISOString(),
    };
    await rest("bonus?on_conflict=participant_id", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(body),
    });
  }

  // ---- Resultados reais (preenchidos pela automação/admin) / actual results ----
  async function fetchResults() {
    const rows = await rest("results?select=*", { headers: headers() });
    const map = {};
    (rows || []).forEach((r) => {
      map[r.match_id] = { home: r.home, away: r.away, advances: r.advances };
    });
    return map;
  }

  async function fetchTournamentResult() {
    const rows = await rest("tournament_result?select=*&limit=1", { headers: headers() });
    const r = rows && rows[0];
    return r ? { champion: r.champion, topScorer: r.top_scorer } : null;
  }

  // ---- Tudo, para o ranking / everything, for the ranking ----
  async function fetchAll() {
    const [participants, predictions, bonus] = await Promise.all([
      rest("participants?select=*", { headers: headers() }),
      rest("predictions?select=*", { headers: headers() }),
      rest("bonus?select=*", { headers: headers() }),
    ]);
    return { participants: participants || [], predictions: predictions || [], bonus: bonus || [] };
  }

  return {
    ready, loginOrRegister, findParticipant,
    pullPredictions, pushPrediction,
    pullBonus, pushBonus,
    fetchResults, fetchTournamentResult,
    fetchAll,
  };
})();
