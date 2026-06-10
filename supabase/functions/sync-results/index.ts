// =========================================================================
// Sync de resultados / Results sync — Supabase Edge Function (Deno)
// Busca os jogos encerrados na football-data.org e grava placar + quem
// avançou na tabela `results` (e campeã/artilheiro em `tournament_result`).
// Roda agendada (cron). Escreve via service role (ignora RLS).
//
// Secrets necessários (Edge Functions → Secrets):
//   FOOTBALL_DATA_TOKEN  -> token da football-data.org
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)
// =========================================================================

const FD_TOKEN = Deno.env.get("FOOTBALL_DATA_TOKEN")!;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STAGE: Record<string, string> = {
  GROUP_STAGE: "group", LAST_32: "r32", LAST_16: "r16",
  QUARTER_FINALS: "qf", SEMI_FINALS: "sf", THIRD_PLACE: "third", FINAL: "final",
};
const KO_ADVANCE = new Set(["r32", "r16", "qf", "sf"]);

const EN_TO_PT: Record<string, string> = {
  "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália",
  "Austria": "Áustria", "Belgium": "Bélgica", "Bosnia-Herzegovina": "Bósnia e Herzegovina",
  "Brazil": "Brasil", "Canada": "Canadá", "Cape Verde Islands": "Cabo Verde",
  "Colombia": "Colômbia", "Congo DR": "RD Congo", "Croatia": "Croácia",
  "Curaçao": "Curaçao", "Czechia": "Tchéquia", "Ecuador": "Equador", "Egypt": "Egito",
  "England": "Inglaterra", "France": "França", "Germany": "Alemanha", "Ghana": "Gana",
  "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque", "Ivory Coast": "Costa do Marfim",
  "Japan": "Japão", "Jordan": "Jordânia", "Mexico": "México", "Morocco": "Marrocos",
  "Netherlands": "Países Baixos", "New Zealand": "Nova Zelândia", "Norway": "Noruega",
  "Panama": "Panamá", "Paraguay": "Paraguai", "Portugal": "Portugal", "Qatar": "Catar",
  "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia", "Senegal": "Senegal",
  "South Africa": "África do Sul", "South Korea": "Coreia do Sul", "Spain": "Espanha",
  "Sweden": "Suécia", "Switzerland": "Suíça", "Tunisia": "Tunísia", "Turkey": "Turquia",
  "United States": "Estados Unidos", "Uruguay": "Uruguai", "Uzbekistan": "Uzbequistão",
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

function normUtc(s: string): string {
  return new Date(s).toISOString().replace(".000Z", "Z");
}

function resolveId(m: any): number | undefined {
  const ph = STAGE[m.stage];
  const utc = normUtc(m.utcDate);
  if (ph === "group") {
    const h = EN_TO_PT[m.homeTeam?.name], a = EN_TO_PT[m.awayTeam?.name];
    return GROUP_MAP[`${utc}|${h}|${a}`];
  }
  return KO_MAP[`${ph}|${utc}`];
}

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

Deno.serve(async () => {
  const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": FD_TOKEN },
  });
  if (!r.ok) return new Response(`football-data ${r.status}`, { status: 502 });
  const data = await r.json();

  const rows: any[] = [];
  let finalChampion: string | null = null;
  for (const m of data.matches ?? []) {
    if (m.status !== "FINISHED") continue;
    const id = resolveId(m);
    if (!id) continue;
    const ph = STAGE[m.stage];
    let advances: string | null = null;
    if (KO_ADVANCE.has(ph) && m.score?.winner) {
      advances = m.score.winner === "HOME_TEAM" ? "home"
        : m.score.winner === "AWAY_TEAM" ? "away" : null;
    }
    rows.push({
      match_id: id,
      home: m.score?.fullTime?.home ?? 0,
      away: m.score?.fullTime?.away ?? 0,
      advances,
      updated_at: new Date().toISOString(),
    });
    if (ph === "final" && m.score?.winner) {
      finalChampion = m.score.winner === "HOME_TEAM"
        ? EN_TO_PT[m.homeTeam?.name] : EN_TO_PT[m.awayTeam?.name];
    }
  }

  if (rows.length) await sbUpsert("results?on_conflict=match_id", rows);

  if (finalChampion) {
    let topScorer: string | null = null;
    try {
      const sc = await fetch("https://api.football-data.org/v4/competitions/WC/scorers?limit=1", {
        headers: { "X-Auth-Token": FD_TOKEN },
      });
      const sd = await sc.json();
      topScorer = sd.scorers?.[0]?.player?.name ?? null;
    } catch (_) { /* ignore */ }
    await sbUpsert("tournament_result?on_conflict=id", {
      id: 1, champion: finalChampion, top_scorer: topScorer, updated_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ updated: rows.length, champion: finalChampion }), {
    headers: { "Content-Type": "application/json" },
  });
});
