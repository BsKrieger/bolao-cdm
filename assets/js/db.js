/**
 * @file Supabase data adapter / Adaptador do Supabase.
 *
 * EN: Talks to the REST API (PostgREST) via fetch — no external library. Every
 *     function is async (returns a Promise). If CONFIG is empty, DB.ready() is
 *     false and the app runs fully local.
 * PT-BR: Fala com a API REST (PostgREST) via fetch — sem biblioteca externa.
 *        Todas as funções são assíncronas (retornam Promise). Se CONFIG estiver
 *        vazio, DB.ready() é false e o app roda 100% local.
 *
 * @author Bruno Krieger
 */
const DB = (() => {
  const URL = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL)
    ? CONFIG.SUPABASE_URL.replace(/\/+$/, "") : "";
  const KEY = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_KEY)
    ? CONFIG.SUPABASE_KEY : "";

  /**
   * Whether the backend is configured and usable.
   * Se o backend está configurado e utilizável.
   *
   * @returns {boolean}
   */
  function ready() { return !!(URL && KEY); }

  /**
   * Builds the auth headers, optionally merged with extras.
   * Monta os cabeçalhos de autenticação, mesclando com extras.
   *
   * @param {Object} [extra] - Extra headers / Cabeçalhos extras.
   * @returns {Object}
   */
  function headers(extra) {
    return Object.assign(
      { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      extra || {}
    );
  }

  /**
   * Generic REST call against /rest/v1/. Throws on non-2xx.
   * Chamada REST genérica contra /rest/v1/. Lança erro em status não-2xx.
   *
   * @param {string} path - Path + query after /rest/v1/ / Caminho + query.
   * @param {RequestInit} options - Fetch options / Opções do fetch.
   * @returns {Promise<*>} Parsed JSON or null / JSON lido ou null.
   */
  async function rest(path, options) {
    const res = await fetch(URL + "/rest/v1/" + path, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("Supabase " + res.status + ": " + body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ---- Participants / participantes ----

  /**
   * Finds a participant by exact name.
   * Busca um participante pelo nome exato.
   *
   * @param {string} name - Participant name / Nome do participante.
   * @returns {Promise<Object|null>}
   */
  async function findParticipant(name) {
    const rows = await rest(
      "participants?select=*&name=eq." + encodeURIComponent(name),
      { headers: headers() }
    );
    return (rows && rows[0]) || null;
  }

  /**
   * Logs in an EXISTING participant (name + code). Registration is disabled: all
   * participants are already enrolled, so a wrong name OR a wrong code just
   * returns an error instead of creating a new user. The message is generic on
   * purpose — it doesn't reveal whether the name exists (avoids user enumeration).
   * Faz login de um participante JÁ EXISTENTE (nome + código). O cadastro está
   * desativado: todos já estão inscritos, então nome OU código errado apenas
   * retorna erro, sem criar usuário novo. A mensagem é genérica de propósito —
   * não revela se o nome existe (evita enumeração de usuários).
   *
   * @param {string} name - Participant name / Nome do participante.
   * @param {string} code - Personal code / Código pessoal.
   * @returns {Promise<{ok:boolean, participant?:Object, error?:string}>}
   */
  async function login(name, code) {
    const existing = await findParticipant(name);
    if (!existing || existing.code !== code) {
      return { ok: false, error: "Nome ou código incorretos. Confira com a organização do bolão." };
    }
    return { ok: true, participant: existing };
  }

  // ---- Predictions / palpites ----

  /**
   * Pulls a participant's predictions, indexed by match id.
   * Puxa os palpites de um participante, indexados por id de jogo.
   *
   * @param {string|number} participantId - Participant id / Id do participante.
   * @returns {Promise<Object<number, {home:number, away:number, advances?:string}>>}
   */
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

  /**
   * Upserts one prediction (merge on participant_id + match_id).
   * Insere/atualiza um palpite (merge por participant_id + match_id).
   *
   * @param {string|number} participantId - Participant id / Id do participante.
   * @param {number} matchId - Match id / Id do jogo.
   * @param {{home?:number, away?:number, advances?:string}} fields - Fields / Campos.
   * @returns {Promise<void>}
   */
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

  // ---- Bonus / bônus ----

  /**
   * Pulls a participant's bonus picks.
   * Puxa os palpites bônus de um participante.
   *
   * @param {string|number} participantId - Participant id / Id do participante.
   * @returns {Promise<{champion?:string, topScorer?:string}>}
   */
  async function pullBonus(participantId) {
    const rows = await rest(
      "bonus?select=*&participant_id=eq." + participantId,
      { headers: headers() }
    );
    const b = rows && rows[0];
    return b ? { champion: b.champion, topScorer: b.top_scorer } : {};
  }

  /**
   * Upserts a participant's bonus picks (merge on participant_id).
   * Insere/atualiza os palpites bônus (merge por participant_id).
   *
   * @param {string|number} participantId - Participant id / Id do participante.
   * @param {{champion?:string, topScorer?:string}} fields - Fields / Campos.
   * @returns {Promise<void>}
   */
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

  // ---- Actual results (filled by the automation/admin) / resultados reais ----

  /**
   * Fetches the official results, indexed by match id.
   * Busca os resultados oficiais, indexados por id de jogo.
   *
   * @returns {Promise<Object<number, {home:number, away:number, advances?:string}>>}
   */
  async function fetchResults() {
    const rows = await rest("results?select=*", { headers: headers() });
    const map = {};
    (rows || []).forEach((r) => {
      map[r.match_id] = { home: r.home, away: r.away, advances: r.advances };
    });
    return map;
  }

  /**
   * Fetches the final tournament outcome (champion + top scorer).
   * Busca o resultado final do torneio (campeão + artilheiro).
   *
   * @returns {Promise<{champion?:string, topScorer?:string}|null>}
   */
  async function fetchTournamentResult() {
    const rows = await rest("tournament_result?select=*&limit=1", { headers: headers() });
    const r = rows && rows[0];
    return r ? { champion: r.champion, topScorer: r.top_scorer } : null;
  }

  // ---- Everything, for the ranking / tudo, para o ranking ----

  /**
   * Fetches EVERY row of a table, paginating in pages of 1000 (PostgREST returns
   * at most 1000 rows per request). A stable `order` is required so pagination
   * never skips or repeats rows.
   * Busca TODAS as linhas de uma tabela, paginando de 1000 em 1000 (o PostgREST
   * devolve no máx. 1000 por requisição). Um `order` estável é obrigatório para a
   * paginação não pular nem repetir linhas.
   *
   * @param {string} table - Table name / Nome da tabela.
   * @param {string} order - Stable order clause / Cláusula de ordenação estável.
   * @returns {Promise<Array>} All rows / Todas as linhas.
   */
  async function fetchAllRows(table, order) {
    const PAGE = 1000;
    let offset = 0;
    const out = [];
    for (;;) {
      const rows = await rest(
        table + "?select=*&order=" + order + "&limit=" + PAGE + "&offset=" + offset,
        { headers: headers() }
      );
      if (!rows || !rows.length) break;
      out.push(...rows);
      if (rows.length < PAGE) break; // última página / last page
      offset += PAGE;
    }
    return out;
  }

  /**
   * Fetches participants, predictions and bonus in parallel.
   * Predictions are paginated: with 23 friends the table crosses 1000 rows, and
   * a single request would silently drop the most recent picks from the ranking
   * and from everyone's-picks. / predictions paginated to dodge the 1000-row cap.
   * Busca participantes, palpites e bônus em paralelo.
   * Os palpites são paginados: com 23 amigos a tabela passa de 1000 linhas, e uma
   * única requisição descartaria calado os palpites mais recentes do ranking e da
   * galera.
   *
   * @returns {Promise<{participants:Array, predictions:Array, bonus:Array}>}
   */
  async function fetchAll() {
    const [participants, predictions, bonus] = await Promise.all([
      rest("participants?select=*", { headers: headers() }),
      fetchAllRows("predictions", "participant_id.asc,match_id.asc"),
      rest("bonus?select=*", { headers: headers() }),
    ]);
    return { participants: participants || [], predictions: predictions || [], bonus: bonus || [] };
  }

  return {
    ready, login, findParticipant,
    pullPredictions, pushPrediction,
    pullBonus, pushBonus,
    fetchResults, fetchTournamentResult,
    fetchAll,
  };
})();
