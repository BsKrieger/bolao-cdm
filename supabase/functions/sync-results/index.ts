/**
 * @file Results sync / Sync de resultados — Supabase Edge Function (Deno).
 *
 * EN: Source is ESPN's public API (FREE, no key). Reads the World Cup games,
 *     takes the FINISHED ones and writes score + who advanced to the `results`
 *     table (and the champion to `tournament_result`). Runs on a cron, writes
 *     via the service role (bypasses RLS). No API secret needed — ESPN is open;
 *     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
 *     The ESPN→our-id map reuses the already-validated UTC times and names; no
 *     match_id is changed.
 * PT-BR: Fonte: API pública da ESPN (GRATUITA, sem chave). Lê os jogos da Copa,
 *        pega os ENCERRADOS e grava placar + quem avançou na tabela `results`
 *        (e a campeã em `tournament_result`). Roda agendada (cron), escreve via
 *        service role (ignora RLS). Não precisa de secret — a ESPN é aberta;
 *        SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase. O
 *        mapa ESPN→nossos IDs reaproveita os horários (UTC) e nomes já
 *        validados; nenhum match_id é alterado.
 *
 * @author Bruno Krieger
 */

import { regulationFromLinescores } from "./regulation.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
// O summary traz o placar por período (1º/2º tempo, prorrogação, pênaltis), de
// onde tiramos o tempo regulamentar no mata-mata. / per-period score endpoint.
const ESPN_SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
// A ESPN limita ~100 eventos por chamada; busco em blocos de datas. / fetch in chunks.
const RANGES = ["20260611-20260627", "20260628-20260710", "20260711-20260719"];

// Nome do time na ESPN -> português. Igual ao nosso mapa, com 2 ajustes
// (ESPN usa "Cape Verde" e "Türkiye"). / ESPN displayName -> PT.
const ESPN_TO_PT: Record<string, string> = {
  "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália",
  "Austria": "Áustria", "Belgium": "Bélgica", "Bosnia-Herzegovina": "Bósnia e Herzegovina",
  "Brazil": "Brasil", "Canada": "Canadá", "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde", "Colombia": "Colômbia", "Congo DR": "RD Congo",
  "Croatia": "Croácia", "Curaçao": "Curaçao", "Czechia": "Tchéquia", "Ecuador": "Equador",
  "Egypt": "Egito", "England": "Inglaterra", "France": "França", "Germany": "Alemanha",
  "Ghana": "Gana", "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque",
  "Ivory Coast": "Costa do Marfim", "Japan": "Japão", "Jordan": "Jordânia",
  "Mexico": "México", "Morocco": "Marrocos", "Netherlands": "Países Baixos",
  "New Zealand": "Nova Zelândia", "Norway": "Noruega", "Panama": "Panamá",
  "Paraguay": "Paraguai", "Portugal": "Portugal", "Qatar": "Catar",
  "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia", "Senegal": "Senegal",
  "South Africa": "África do Sul", "South Korea": "Coreia do Sul", "Spain": "Espanha",
  "Sweden": "Suécia", "Switzerland": "Suíça", "Tunisia": "Tunísia",
  "Türkiye": "Turquia", "Turkey": "Turquia", "United States": "Estados Unidos",
  "Uruguay": "Uruguai", "Uzbekistan": "Uzbequistão",
};

// Mapa fase|utc -> nosso id (mata-mata) / knockout map
const KO_MAP: Record<string, number> = {
  "r32|2026-06-28T19:00:00Z": 73, "r32|2026-06-29T20:30:00Z": 74, "r32|2026-06-30T01:00:00Z": 75,
  "r32|2026-06-29T17:00:00Z": 76, "r32|2026-06-30T21:00:00Z": 77, "r32|2026-06-30T17:00:00Z": 78,
  "r32|2026-07-01T01:00:00Z": 79, "r32|2026-07-01T16:00:00Z": 80, "r32|2026-07-02T00:00:00Z": 81,
  "r32|2026-07-01T20:00:00Z": 82, "r32|2026-07-02T23:00:00Z": 83, "r32|2026-07-02T19:00:00Z": 84,
  "r32|2026-07-03T03:00:00Z": 85, "r32|2026-07-03T22:00:00Z": 86, "r32|2026-07-04T01:30:00Z": 87,
  "r32|2026-07-03T18:00:00Z": 88, "r16|2026-07-04T21:00:00Z": 89, "r16|2026-07-04T17:00:00Z": 90,
  "r16|2026-07-05T20:00:00Z": 91, "r16|2026-07-06T00:00:00Z": 92, "r16|2026-07-06T19:00:00Z": 93,
  "r16|2026-07-07T00:00:00Z": 94, "r16|2026-07-07T16:00:00Z": 95, "r16|2026-07-07T20:00:00Z": 96,
  "qf|2026-07-09T20:00:00Z": 97, "qf|2026-07-10T19:00:00Z": 98, "qf|2026-07-11T21:00:00Z": 99,
  "qf|2026-07-12T01:00:00Z": 100, "sf|2026-07-14T19:00:00Z": 101, "sf|2026-07-15T19:00:00Z": 102,
  "third|2026-07-18T21:00:00Z": 103, "final|2026-07-19T19:00:00Z": 104,
};

// Mapa utc|mandante|visitante (PT) -> nosso id (fase de grupos) / group map
const GROUP_MAP: Record<string, number> = {
  "2026-06-11T19:00:00Z|México|África do Sul": 1, "2026-06-12T02:00:00Z|Coreia do Sul|Tchéquia": 2,
  "2026-06-18T16:00:00Z|Tchéquia|África do Sul": 3, "2026-06-19T01:00:00Z|México|Coreia do Sul": 4,
  "2026-06-25T01:00:00Z|Tchéquia|México": 5, "2026-06-25T01:00:00Z|África do Sul|Coreia do Sul": 6,
  "2026-06-12T19:00:00Z|Canadá|Bósnia e Herzegovina": 7, "2026-06-13T19:00:00Z|Catar|Suíça": 8,
  "2026-06-18T19:00:00Z|Suíça|Bósnia e Herzegovina": 9, "2026-06-18T22:00:00Z|Canadá|Catar": 10,
  "2026-06-24T19:00:00Z|Suíça|Canadá": 11, "2026-06-24T19:00:00Z|Bósnia e Herzegovina|Catar": 12,
  "2026-06-13T22:00:00Z|Brasil|Marrocos": 13, "2026-06-14T01:00:00Z|Haiti|Escócia": 14,
  "2026-06-19T22:00:00Z|Escócia|Marrocos": 15, "2026-06-20T00:30:00Z|Brasil|Haiti": 16,
  "2026-06-24T22:00:00Z|Escócia|Brasil": 17, "2026-06-24T22:00:00Z|Marrocos|Haiti": 18,
  "2026-06-13T01:00:00Z|Estados Unidos|Paraguai": 19, "2026-06-14T04:00:00Z|Austrália|Turquia": 20,
  "2026-06-19T19:00:00Z|Estados Unidos|Austrália": 21, "2026-06-20T03:00:00Z|Turquia|Paraguai": 22,
  "2026-06-26T02:00:00Z|Turquia|Estados Unidos": 23, "2026-06-26T02:00:00Z|Paraguai|Austrália": 24,
  "2026-06-14T17:00:00Z|Alemanha|Curaçao": 25, "2026-06-14T23:00:00Z|Costa do Marfim|Equador": 26,
  "2026-06-20T20:00:00Z|Alemanha|Costa do Marfim": 27, "2026-06-21T00:00:00Z|Equador|Curaçao": 28,
  "2026-06-25T20:00:00Z|Curaçao|Costa do Marfim": 29, "2026-06-25T20:00:00Z|Equador|Alemanha": 30,
  "2026-06-14T20:00:00Z|Países Baixos|Japão": 31, "2026-06-15T02:00:00Z|Suécia|Tunísia": 32,
  "2026-06-20T17:00:00Z|Países Baixos|Suécia": 33, "2026-06-21T04:00:00Z|Tunísia|Japão": 34,
  "2026-06-25T23:00:00Z|Japão|Suécia": 35, "2026-06-25T23:00:00Z|Tunísia|Países Baixos": 36,
  "2026-06-15T19:00:00Z|Bélgica|Egito": 37, "2026-06-16T01:00:00Z|Irã|Nova Zelândia": 38,
  "2026-06-21T19:00:00Z|Bélgica|Irã": 39, "2026-06-22T01:00:00Z|Nova Zelândia|Egito": 40,
  "2026-06-27T03:00:00Z|Egito|Irã": 41, "2026-06-27T03:00:00Z|Nova Zelândia|Bélgica": 42,
  "2026-06-15T16:00:00Z|Espanha|Cabo Verde": 43, "2026-06-15T22:00:00Z|Arábia Saudita|Uruguai": 44,
  "2026-06-21T16:00:00Z|Espanha|Arábia Saudita": 45, "2026-06-21T22:00:00Z|Uruguai|Cabo Verde": 46,
  "2026-06-27T00:00:00Z|Cabo Verde|Arábia Saudita": 47, "2026-06-27T00:00:00Z|Uruguai|Espanha": 48,
  "2026-06-16T19:00:00Z|França|Senegal": 49, "2026-06-16T22:00:00Z|Iraque|Noruega": 50,
  "2026-06-22T21:00:00Z|França|Iraque": 51, "2026-06-23T00:00:00Z|Noruega|Senegal": 52,
  "2026-06-26T19:00:00Z|Noruega|França": 53, "2026-06-26T19:00:00Z|Senegal|Iraque": 54,
  "2026-06-17T01:00:00Z|Argentina|Argélia": 55, "2026-06-17T04:00:00Z|Áustria|Jordânia": 56,
  "2026-06-22T17:00:00Z|Argentina|Áustria": 57, "2026-06-23T03:00:00Z|Jordânia|Argélia": 58,
  "2026-06-28T02:00:00Z|Argélia|Áustria": 59, "2026-06-28T02:00:00Z|Jordânia|Argentina": 60,
  "2026-06-17T17:00:00Z|Portugal|RD Congo": 61, "2026-06-18T02:00:00Z|Uzbequistão|Colômbia": 62,
  "2026-06-23T17:00:00Z|Portugal|Uzbequistão": 63, "2026-06-24T02:00:00Z|Colômbia|RD Congo": 64,
  "2026-06-27T23:30:00Z|Colômbia|Portugal": 65, "2026-06-27T23:30:00Z|RD Congo|Uzbequistão": 66,
  "2026-06-17T20:00:00Z|Inglaterra|Croácia": 67, "2026-06-17T23:00:00Z|Gana|Panamá": 68,
  "2026-06-23T20:00:00Z|Inglaterra|Gana": 69, "2026-06-23T23:00:00Z|Panamá|Croácia": 70,
  "2026-06-27T21:00:00Z|Panamá|Inglaterra": 71, "2026-06-27T21:00:00Z|Croácia|Gana": 72,
};

// Derivados do KO_MAP: utc -> id (mata-mata não tem time real do nosso lado,
// só "slot", então casamos pelo horário) e quais ids têm "quem avança".
const KO_BY_UTC: Record<string, number> = {};
const KO_ADVANCE_IDS = new Set<number>();
for (const key of Object.keys(KO_MAP)) {
  const [phase, utc] = key.split("|");
  KO_BY_UTC[utc] = KO_MAP[key];
  if (phase === "r32" || phase === "r16" || phase === "qf" || phase === "sf") {
    KO_ADVANCE_IDS.add(KO_MAP[key]);
  }
}

// Todos os ids de mata-mata (r32→final). Nesses, o placar que vale é o do tempo
// regulamentar (90'). / every knockout id; these score regulation time only.
const KO_IDS = new Set<number>(Object.values(KO_MAP));

/**
 * Normalizes a date string to a canonical UTC ISO key (no millis).
 * Normaliza uma data para uma chave ISO UTC canônica (sem milissegundos).
 *
 * @param s - Date string / String de data.
 * @returns Canonical UTC ISO / ISO UTC canônico.
 */
function normUtc(s: string): string {
  return new Date(s).toISOString().replace(".000Z", "Z");
}

/**
 * Matches an ESPN game to our id: group stage by (utc|teams), knockout by (utc).
 * Casa o jogo da ESPN com o nosso id: grupos por (utc|times), mata-mata por (utc).
 *
 * @param utc - Canonical UTC key / Chave UTC canônica.
 * @param homePT - Home team (PT) / Mandante (PT).
 * @param awayPT - Away team (PT) / Visitante (PT).
 * @returns Our match id, or undefined when unmatched / Nosso id, ou undefined.
 */
function resolveId(utc: string, homePT?: string, awayPT?: string): number | undefined {
  if (homePT && awayPT) {
    const g = GROUP_MAP[`${utc}|${homePT}|${awayPT}`];
    if (g) return g;
  }
  return KO_BY_UTC[utc];
}

/**
 * Upserts rows into a Supabase table via PostgREST (merge duplicates).
 * Insere/atualiza linhas numa tabela do Supabase via PostgREST (merge).
 *
 * @param path - Table + query after /rest/v1/ / Tabela + query.
 * @param body - Row(s) to upsert / Linha(s) a gravar.
 */
async function sbUpsert(path: string, body: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

/**
 * Fetches ESPN events in date chunks and de-duplicates by event id.
 * Busca os eventos da ESPN em blocos de datas e remove duplicados por id.
 *
 * @returns Unique ESPN events / Eventos únicos da ESPN.
 */
async function fetchEvents(): Promise<any[]> {
  const byId = new Map<string, any>();
  for (const range of RANGES) {
    try {
      const r = await fetch(`${ESPN}?dates=${range}`);
      if (!r.ok) continue;
      const d = await r.json();
      for (const e of d.events ?? []) byId.set(e.id, e);
    } catch (_) { /* ignora bloco que falhar */ }
  }
  return [...byId.values()];
}

/**
 * Fetches one game's summary and returns the regulation-time score (90'),
 * summing the first two periods of each side. Returns null when ESPN doesn't
 * expose usable linescores (the caller then skips the row).
 * Busca o summary de um jogo e devolve o placar do tempo regulamentar (90'),
 * somando os dois primeiros períodos de cada lado. Devolve null quando a ESPN
 * não traz linescores utilizáveis (quem chama então pula a linha).
 *
 * @param eventId - ESPN event id / id do evento na ESPN.
 * @returns {home, away} in regulation, or null / no regulamentar, ou null.
 */
async function fetchRegulation(
  eventId: string,
): Promise<{ home: number; away: number } | null> {
  try {
    const r = await fetch(`${ESPN_SUMMARY}?event=${eventId}`);
    if (!r.ok) return null;
    const d = await r.json();
    const cs = d?.header?.competitions?.[0]?.competitors ?? [];
    const home = cs.find((c: any) => c.homeAway === "home");
    const away = cs.find((c: any) => c.homeAway === "away");
    const h = regulationFromLinescores(home?.linescores);
    const a = regulationFromLinescores(away?.linescores);
    if (h === null || a === null) return null;
    return { home: h, away: a };
  } catch (_) {
    return null;
  }
}

/**
 * Cron entry point: fetches finished games, maps them to our ids, upserts the
 * results (and the champion at the end), and returns a small JSON summary.
 * Entrada do cron: busca jogos encerrados, casa com nossos ids, grava os
 * resultados (e a campeã no fim) e devolve um pequeno resumo em JSON.
 */
Deno.serve(async () => {
  const events = await fetchEvents();

  // 1) Casa cada jogo encerrado com o nosso id / match each finished game to our id.
  const finished: Array<
    { eventId: string; id: number; cs: any[]; home: any; away: any }
  > = [];
  for (const e of events) {
    if (!e?.status?.type?.completed) continue;          // só jogos encerrados
    const cs = e.competitions?.[0]?.competitors ?? [];
    const home = cs.find((c: any) => c.homeAway === "home");
    const away = cs.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const utc = normUtc(e.date);
    const homePT = ESPN_TO_PT[home.team?.displayName];
    const awayPT = ESPN_TO_PT[away.team?.displayName];
    const id = resolveId(utc, homePT, awayPT);
    if (!id) continue;                                   // não casou: deixa sem resultado

    finished.push({ eventId: e.id, id, cs, home, away });
  }

  // 2) No mata-mata, o palpite vale o TEMPO REGULAMENTAR (90'). A ESPN só expõe
  //    o placar por período no `summary`, então buscamos um por jogo (em
  //    paralelo). Grupos não têm prorrogação: o placar do scoreboard já é 90'.
  //    Knockouts score regulation time (90'); fetch per-game summaries.
  const regulation = new Map<number, { home: number; away: number } | null>();
  await Promise.all(
    finished.filter((f) => KO_IDS.has(f.id)).map(async (f) => {
      regulation.set(f.id, await fetchRegulation(f.eventId));
    }),
  );

  // 3) Monta as linhas a gravar / build the rows to upsert.
  const rows: any[] = [];
  let champion: string | null = null;

  for (const f of finished) {
    let home: number, away: number;
    if (KO_IDS.has(f.id)) {
      const reg = regulation.get(f.id);
      if (!reg) {                                        // sem linescores: não grava placar errado
        console.error(
          `sync-results: sem placar regulamentar p/ jogo ${f.id} (event ${f.eventId}); pulando`,
        );
        continue;
      }
      home = reg.home;
      away = reg.away;
    } else {
      home = parseInt(f.home.score, 10) || 0;            // grupos: scoreboard já é 90'
      away = parseInt(f.away.score, 10) || 0;
    }

    let advances: string | null = null;
    if (KO_ADVANCE_IDS.has(f.id)) {
      // "advance" cobre pênaltis; cai pra "winner" se faltar.
      const adv = f.cs.find((c: any) => c.advance === true) ??
        f.cs.find((c: any) => c.winner === true);
      if (adv) advances = adv.homeAway === "home" ? "home" : "away";
    }

    rows.push({
      match_id: f.id,
      home,
      away,
      advances,
      updated_at: new Date().toISOString(),
    });

    if (f.id === 104) {                                  // final -> campeã (quem venceu de fato)
      const w = f.cs.find((c: any) => c.winner === true) ??
        f.cs.find((c: any) => c.advance === true);
      if (w) champion = ESPN_TO_PT[w.team?.displayName] ?? null;
    }
  }

  if (rows.length) await sbUpsert("results?on_conflict=match_id", rows);

  // Só a campeã é automática; o artilheiro fica pra preencher à mão (não
  // sobrescreve o top_scorer já salvo).
  if (champion) {
    await sbUpsert("tournament_result?on_conflict=id", {
      id: 1, champion, updated_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ updated: rows.length, champion }), {
    headers: { "Content-Type": "application/json" },
  });
});
