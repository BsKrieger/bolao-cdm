/**
 * @file Knockout real teams / Times reais do mata-mata.
 *
 * EN: Until the groups finish, our knockout matches carry slot labels ("1º A",
 *     "Ven. J89"). Once ESPN assigns the real teams, this hydrates MATCHES in
 *     place: it overwrites home/away of each knockout match with the real team
 *     names (PT-BR) when BOTH sides are known, matching our match to ESPN's by
 *     kickoff time (±90 min). The home/away order follows FIFA's seeding (checked
 *     across the round of 32), so the prediction side stays correct. Read-only
 *     against ESPN; on any failure it leaves the slot labels untouched.
 * PT-BR: Até os grupos acabarem, nossos jogos de mata-mata usam rótulos de vaga
 *        ("1º A", "Ven. J89"). Quando a ESPN define os times reais, isto hidrata
 *        o MATCHES no lugar: sobrescreve home/away de cada jogo de mata-mata com
 *        o nome real (PT-BR) quando os DOIS lados estão definidos, casando nosso
 *        jogo com o da ESPN pelo horário (±90 min). A ordem home/away segue o
 *        seeding da FIFA (conferido nos 16-avos), então o lado do palpite
 *        permanece correto. Read-only na ESPN; em qualquer falha, mantém as vagas.
 *
 * @author Bruno Krieger
 */
const KoTeams = (() => {
  const SB = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  // Blocos de datas só do mata-mata (28/06 em diante). / knockout date chunks.
  const RANGES = ["20260628-20260710", "20260711-20260720"];
  const TOLERANCE_MS = 90 * 60000; // folga ao casar por horário / kickoff tolerance.

  /**
   * ESPN team name -> PT-BR via the shared map (null when unknown).
   * Nome do time na ESPN -> PT-BR pelo mapa compartilhado (null se desconhecido).
   *
   * @param {?string} espn - ESPN display name / Nome na ESPN.
   * @returns {?string}
   */
  function ptName(espn) {
    return (typeof ESPN_TO_PT !== "undefined" && ESPN_TO_PT[espn]) || null;
  }

  /**
   * Fetches knockout scoreboard events from ESPN, de-duped by id.
   * Busca os eventos do mata-mata no scoreboard da ESPN, sem duplicar.
   *
   * @returns {Promise<Array>}
   */
  async function fetchEvents() {
    const byId = {};
    for (const range of RANGES) {
      try {
        // timeout de 6s p/ a ESPN lenta nunca travar a página / abort slow ESPN.
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(SB + "?dates=" + range, { cache: "no-store", signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) continue;
        const d = await r.json();
        (d.events || []).forEach((e) => { byId[e.id] = e; });
      } catch (_) { /* ignora bloco que falhar/timeout / skip failed chunk */ }
    }
    return Object.values(byId);
  }

  /**
   * Real {home, away} (PT-BR) for an ESPN event, or null when a side is missing
   * or untranslatable. Uses ESPN's home/away order (matches our seeding).
   * {home, away} reais (PT-BR) de um jogo da ESPN, ou null quando falta um lado
   * ou não traduz. Usa a ordem home/away da ESPN (bate com o nosso seeding).
   *
   * @param {?Object} e - ESPN event / Jogo da ESPN.
   * @returns {?{home:string, away:string}}
   */
  function realTeams(e) {
    const cs = (e && e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
    const eh = cs.find((c) => c.homeAway === "home") || cs[0];
    const ea = cs.find((c) => c.homeAway === "away") || cs[1];
    const h = eh && ptName(eh.team && eh.team.displayName);
    const a = ea && ptName(ea.team && ea.team.displayName);
    return (h && a) ? { home: h, away: a } : null;
  }

  /**
   * Hydrates MATCHES in place: overwrites home/away of knockout matches with the
   * real teams when ESPN has both sides. Keeps the original slot in
   * _homeSlot/_awaySlot (idempotent). On any failure, leaves everything as is.
   * Hidrata o MATCHES no lugar: sobrescreve home/away dos jogos de mata-mata com
   * os times reais quando a ESPN tem os dois lados. Guarda a vaga original em
   * _homeSlot/_awaySlot (idempotente). Em qualquer falha, mantém tudo.
   *
   * @param {Array} matches - The MATCHES array (mutated) / O array MATCHES (mutado).
   * @returns {Promise<Array>}
   */
  async function hydrate(matches) {
    if (!Array.isArray(matches)) return matches;
    try {
      const events = await fetchEvents();
      const byTime = {};
      events.forEach((e) => { byTime[new Date(e.date).getTime()] = e; });
      const times = Object.keys(byTime).map(Number);

      matches.forEach((m) => {
        if (!m || m.phase === "group") return;
        const t = new Date(m.kickoff).getTime();
        let e = byTime[t];
        if (!e) {                                   // casa pelo horário mais próximo
          let best = null, bestD = TOLERANCE_MS;
          times.forEach((k) => {
            const d = Math.abs(k - t);
            if (d <= bestD) { bestD = d; best = byTime[k]; }
          });
          e = best;
        }
        const real = realTeams(e);
        if (real) {
          if (m._homeSlot == null) { m._homeSlot = m.home; m._awaySlot = m.away; }
          m.home = real.home;
          m.away = real.away;
        }
      });
    } catch (_) { /* fallback: mantém os rótulos de vaga / keep slot labels */ }
    return matches;
  }

  return { hydrate };
})();

// Funciona no navegador; exportável se um dia houver testes em Node.
if (typeof module !== "undefined" && module.exports) module.exports = KoTeams;
