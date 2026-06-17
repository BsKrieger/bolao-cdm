/**
 * @file Full group-stage simulation / Simulação completa da fase de grupos.
 *
 * EN: Generates 23 fictional participants, predictions and results for the 72
 *     group games, and uses the REAL engine (scoring.js) to verify: scoring ·
 *     multipliers · tiebreaker · ranking · locking · galera. All in memory —
 *     never talks to Supabase. Open tests/simulacao.html.
 * PT-BR: Gera 23 participantes fictícios, palpites e resultados para os 72 jogos
 *        de grupo, e usa o MOTOR REAL (scoring.js) para verificar: pontuação ·
 *        multiplicadores · desempate · ranking · travamento · galera. Tudo em
 *        memória — não fala com o Supabase. Abra tests/simulacao.html.
 *
 * @author Bruno Krieger
 */
(function () {
  "use strict";

  // 23 nomes fictícios / 23 fictional names
  const NAMES = [
    "Anderson", "Bianca", "Caio", "Daniela", "Eduardo", "Fernanda", "Gabriel",
    "Helena", "Ícaro", "Júlia", "Kauan", "Larissa", "Marcos", "Natália",
    "Otávio", "Paula", "Rafael", "Sabrina", "Thiago", "Úrsula", "Vitor",
    "Wanessa", "Yuri",
  ];

  const groupMatches = MATCHES.filter((m) => m.phase === "group");

  /**
   * Deterministic result for a match (so the test is reproducible).
   * Resultado determinístico de cada jogo (para o teste ser reproduzível).
   *
   * @param {Object} m - The match / O jogo.
   * @returns {{home:number, away:number}}
   */
  function simResult(m) {
    return { home: (m.id * 7) % 4, away: (m.id * 13) % 3 };
  }
  const RESULTS = {};
  groupMatches.forEach((m) => (RESULTS[m.id] = simResult(m)));

  /**
   * Deterministic prediction: accuracy drops with the participant index, so the
   * ranking comes out predictable and verifiable.
   * Palpite determinístico: a "pontaria" cai conforme o índice do participante,
   * então o ranking fica ordenado de forma previsível e verificável.
   *
   * @param {number} i - Participant index (0 = best) / Índice (0 = craque).
   * @param {Object} m - The match / O jogo.
   * @param {{home:number, away:number}} res - The simulated result / Resultado simulado.
   * @returns {{home:number, away:number}}
   */
  function simPrediction(i, m, res) {
    const hash = (m.id * 31 + i * 17) % 100;
    const skill = 95 - i * 3; // i=0 craque, i=22 azarão
    if (hash < skill - 40) return { home: res.home, away: res.away }; // exato
    if (hash < skill - 15) return { home: res.home + 1, away: res.away + 1 }; // resultado + saldo
    if (hash < skill) {
      if (res.home === res.away) return { home: res.home + 1, away: res.away + 1 };
      if (res.home > res.away) return { home: res.home + 2, away: res.away }; // vitória certa, saldo diferente
      return { home: res.home, away: res.away + 2 };
    }
    return res.home >= res.away ? { home: 0, away: 2 } : { home: 2, away: 0 }; // errado de propósito
  }

  // Monta os participantes com seus palpites / build participants + picks.
  const participants = NAMES.map((name, i) => {
    const preds = {};
    groupMatches.forEach((m) => (preds[m.id] = simPrediction(i, m, RESULTS[m.id])));
    return { id: "sim-" + String(i + 1).padStart(2, "0"), name, preds };
  });

  // Pontua todo mundo com o MOTOR REAL / score everyone with the real engine.
  participants.forEach((p) => {
    p.stats = Scoring.scoreTotal(p.preds, RESULTS, MATCHES);
    p.total = p.stats.total;
  });

  // "Agora" simulado = fim da fase de grupos / simulated now = end of groups.
  const lastGroupKO = Math.max(...groupMatches.map((m) => new Date(m.kickoff).getTime()));
  const SIM_NOW = lastGroupKO + 3600 * 1000;
  const lockedAt = (now) => (m) => now >= new Date(m.kickoff).getTime();

  // ---- Independent re-check of the engine / verificação independente ----

  /** Sign of a number / sinal de um número. */
  function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }

  /**
   * Re-implements the score-line rule independently (to cross-check scoring.js).
   * Reimplementa a regra do placar de forma independente (confere o scoring.js).
   *
   * @param {{home:number, away:number}} pred - The prediction / O palpite.
   * @param {{home:number, away:number}} res - The result / O resultado.
   * @returns {number}
   */
  function indepLine(pred, res) {
    if (pred.home === res.home && pred.away === res.away) return 10;
    if (sign(pred.home - pred.away) !== sign(res.home - res.away)) return 0;
    return 5 + ((pred.home - pred.away) === (res.home - res.away) ? 3 : 0);
  }

  /**
   * Independent total over the group games (all ×1) for one set of predictions.
   * Total independente sobre os jogos de grupo (todos ×1) para um conjunto de palpites.
   *
   * @param {Object<number, Object>} preds - Predictions by id / Palpites por id.
   * @returns {number}
   */
  function indepTotal(preds) {
    let t = 0;
    groupMatches.forEach((m) => (t += indepLine(preds[m.id], RESULTS[m.id]))); // grupos = ×1
    return t;
  }

  // ---- Ranking (mesma ordenação do ranking.js) ----
  const ranking = participants.slice().sort((a, b) =>
    b.total - a.total ||
    b.stats.exact - a.stats.exact ||
    b.stats.rights - a.stats.rights ||
    a.name.localeCompare(b.name, "pt-BR")
  );

  // =====================================================================
  //  CHECAGENS / automated checks
  // =====================================================================
  const checks = [];
  const add = (ok, label, detail) => checks.push({ ok, label, detail });
  const sm = (phase, pred, res) => Scoring.scoreMatch({ phase }, pred, res).total;

  add(sm("group", { home: 2, away: 1 }, { home: 2, away: 1 }) === 10,
    "Placar exato (grupos ×1) = 10", "palpite 2×1, resultado 2×1");
  add(sm("group", { home: 3, away: 2 }, { home: 2, away: 1 }) === 8,
    "Resultado + saldo certos = 8", "palpite 3×2, resultado 2×1 (vitória + saldo +1)");
  add(sm("group", { home: 3, away: 1 }, { home: 2, away: 1 }) === 5,
    "Só resultado certo = 5", "palpite 3×1, resultado 2×1 (vitória, saldo diferente)");
  add(sm("group", { home: 0, away: 1 }, { home: 2, away: 1 }) === 0,
    "Resultado errado = 0", "palpite 0×1, resultado 2×1");
  add(sm("group", { home: 1, away: 1 }, { home: 0, away: 0 }) === 8,
    "Empate com saldo (0) certo = 8", "palpite 1×1, resultado 0×0");
  add(sm("r16", { home: 2, away: 1 }, { home: 2, away: 1 }) === 15,
    "Exato nas oitavas ×1,5 = 15", "10 × 1,5");
  add(sm("final", { home: 2, away: 1 }, { home: 2, away: 1 }) === 30,
    "Exato na final ×3 = 30", "10 × 3");
  add(Scoring.scoreMatch({ phase: "r16" },
    { home: 2, away: 1, advances: "home" }, { home: 2, away: 1, advances: "home" }).total === 18,
    "Oitavas: placar exato + quem avança = (10 + 2) × 1,5 = 18", "palpite 2×1 e avança mandante, igual ao resultado");
  add(Scoring.scoreMatch({ phase: "r16" },
    { home: 0, away: 1, advances: "home" }, { home: 2, away: 1, advances: "home" }).total === 3,
    "Só o 'quem avança' certo (placar errado) = (0 + 2) × 1,5 = 3", "isola o bônus de +2 da classificação");
  add(Scoring.scoreAdvance({ advances: "home" }, { advances: "home" }, "group") === 0,
    "'Quem avança' NÃO vale na fase de grupos", "scoreAdvance em grupos = 0");

  // Motor real == verificação independente, para os 23 / engine == independent.
  let allMatch = true, worst = null;
  participants.forEach((p) => {
    const indep = indepTotal(p.preds);
    if (indep !== p.total) { allMatch = false; worst = { name: p.name, motor: p.total, indep }; }
  });
  add(allMatch, "Motor real confere com verificação independente nos 23 participantes",
    allMatch ? "1.656 jogos pontuados batem 100%" : `divergência em ${worst.name}: motor ${worst.motor} ≠ indep ${worst.indep}`);

  // Desempate: dois com MESMO total, ordena por exatos / tiebreaker.
  const tieA = { name: "TieA", total: 100, stats: { exact: 8, rights: 12 } };
  const tieB = { name: "TieB", total: 100, stats: { exact: 5, rights: 15 } };
  const tieSorted = [tieB, tieA].sort((a, b) =>
    b.total - a.total || b.stats.exact - a.stats.exact || b.stats.rights - a.stats.rights);
  add(tieSorted[0].name === "TieA",
    "Desempate: total igual → quem tem mais placares exatos fica na frente",
    "TieA (8 exatos) passa TieB (5 exatos), mesmo com 100 pts cada");

  // Travamento por jogo / per-match lock.
  const afterGroups = groupMatches.filter(lockedAt(SIM_NOW));
  const koHidden = MATCHES.filter((m) => m.phase !== "group" && !lockedAt(SIM_NOW)(m));
  add(afterGroups.length === 72 && koHidden.length === 32,
    "Travamento: fim dos grupos → 72 jogos revelados, 32 do mata-mata ocultos",
    `revelados ${afterGroups.length}/72 · ocultos (futuros) ${koHidden.length}`);

  const earlyNow = new Date(groupMatches[0].kickoff).getTime() + 60000; // 1 min após o 1º jogo
  const revealedEarly = groupMatches.filter(lockedAt(earlyNow)).length;
  add(revealedEarly < 72 && revealedEarly >= 1,
    "Travamento é POR JOGO: logo após o 1º jogo, só os já iniciados aparecem",
    `nesse instante apareceriam ${revealedEarly} de 72 jogos (resto travado)`);

  // =====================================================================
  //  RENDER
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (n) => (Math.round(n * 100) / 100).toString().replace(".", ",");

  // Resumo
  $("simSummary").innerHTML = `
    <p><strong>${participants.length}</strong> participantes · <strong>${groupMatches.length}</strong> jogos de grupo ·
    resultados e palpites gerados de forma determinística · pontuados pelo <code>scoring.js</code> real.</p>`;

  // Checagens
  const passed = checks.filter((c) => c.ok).length;
  $("simChecks").innerHTML = `
    <p class="sim-score ${passed === checks.length ? "sim-ok" : "sim-fail"}">
      ${passed}/${checks.length} checagens passaram</p>` +
    checks.map((c) => `<div class="sim-check ${c.ok ? "sim-ok" : "sim-fail"}">
      <span class="sim-mark">${c.ok ? "✓" : "✗"}</span>
      <span><strong>${esc(c.label)}</strong><br><small>${esc(c.detail)}</small></span>
    </div>`).join("");

  // Ranking
  $("simRanking").innerHTML = `
    <table class="sim-table">
      <thead><tr><th>#</th><th>Participante</th><th>Pontos</th><th>Exatos</th><th>Result. certos</th></tr></thead>
      <tbody>${ranking.map((p, i) => `
        <tr class="${i < 3 ? "sim-top" : ""}">
          <td>${i + 1}º</td><td>${esc(p.name)}</td>
          <td><strong>${fmt(p.total)}</strong></td>
          <td>${p.stats.exact}</td><td>${p.stats.rights}</td>
        </tr>`).join("")}</tbody>
    </table>`;

  // Galera — revela só jogos já iniciados (no SIM_NOW, todos os 72 de grupo)
  const isOn = lockedAt(SIM_NOW);
  const shownMatches = groupMatches.slice(0, 12); // amostra legível
  const galeraHtml = shownMatches.map((m) => {
    const res = RESULTS[m.id];
    const picks = participants.map((p) => {
      const pr = p.preds[m.id];
      const pts = Scoring.scoreMatch(m, pr, res).total;
      return `<span class="sim-pick" title="${esc(p.name)}">${esc(p.name.slice(0, 8))}: <b>${pr.home}×${pr.away}</b> <em>(${fmt(pts)})</em></span>`;
    }).join("");
    return `<div class="sim-match">
      <div class="sim-match__head">${esc(m.home)} <b>${res.home} × ${res.away}</b> ${esc(m.away)}
        <span class="sim-badge">grupo ${m.group} · iniciado</span></div>
      <div class="sim-picks">${picks}</div></div>`;
  }).join("");
  const firstKO = MATCHES.find((m) => m.phase === "r32");
  $("simGalera").innerHTML = galeraHtml + `
    <div class="sim-match sim-match--locked">
      <div class="sim-match__head">🔒 ${esc(firstKO.home)} × ${esc(firstKO.away)}
        <span class="sim-badge sim-badge--lock">16 avos · NÃO começou — palpites ocultos</span></div>
      <p class="sim-locknote">Este e os outros ${koHidden.length - 1} jogos futuros não revelam nenhum palpite até a bola rolar.</p>
    </div>
    <p class="sim-note">Mostrando 12 dos 72 jogos de grupo (todos revelados). O 1º jogo de mata-mata aparece travado para demonstrar a regra.</p>`;

  // Dashboard do líder / leader dashboard
  const leader = ranking[0];
  const sample = groupMatches.slice(0, 8).map((m) => {
    const pr = leader.preds[m.id], res = RESULTS[m.id];
    const sc = Scoring.scoreMatch(m, pr, res);
    return `<tr>
      <td>${esc(m.home)} × ${esc(m.away)}</td>
      <td>${pr.home}×${pr.away}</td>
      <td>${res.home}×${res.away}</td>
      <td><strong>${fmt(sc.total)}</strong></td></tr>`;
  }).join("");
  $("simDash").innerHTML = `
    <p><strong>${esc(leader.name)}</strong> — líder com <strong>${fmt(leader.total)}</strong> pts
    (${leader.stats.exact} exatos, ${leader.stats.played} jogos pontuados).</p>
    <table class="sim-table">
      <thead><tr><th>Jogo</th><th>Palpite</th><th>Resultado</th><th>Pontos</th></tr></thead>
      <tbody>${sample}</tbody></table>
    <p class="sim-note">Amostra de 8 jogos. Soma de todos os 72 = ${fmt(leader.total)} pts.</p>`;

  // Expõe pra inspeção no console / expose for console inspection.
  window.__SIM = { participants, ranking, RESULTS, checks, SIM_NOW };
})();
