/**
 * @file 2026 World Cup matches / Jogos da Copa do Mundo 2026.
 *
 * EN:
 *  - kickoff: start time ALREADY IN BRASÍLIA (UTC-3), ISO with "-03:00" offset.
 *    new Date(kickoff) reads the offset correctly (lock/countdown).
 *  - Times validated against ESPN Brasil and CNN Brasil; group games may vary
 *    ±1h between sources — confirm the ones that matter before sharing.
 *  - Knockout (id 73-104): teams are "slots" (e.g. "1º A", "Ven. J73"); replace
 *    with the real team once the bracket is defined.
 *  - phase: a key in PHASES. multiplier null = still to be defined.
 * PT-BR:
 *  - kickoff: horário de início JÁ EM BRASÍLIA (UTC-3), ISO com offset "-03:00".
 *    new Date(kickoff) interpreta o offset corretamente (trava/countdown).
 *  - Horários validados contra ESPN Brasil e CNN Brasil; jogos de grupos podem
 *    variar ±1h entre fontes — confirme os que importam antes de liberar.
 *  - Mata-mata (id 73-104): times são "slots" (ex.: "1º A", "Ven. J73"); troque
 *    pelo nome real quando os confrontos forem definidos.
 *  - phase: chave em PHASES. multiplier null = você ainda vai definir.
 *
 * @author Bruno Krieger
 */

const PHASES = {
  group: { name: "Fase de grupos",      multiplier: 1    },
  r32:   { name: "16 avos de final",    multiplier: 1.25 },
  r16:   { name: "Oitavas de final",    multiplier: 1.5  },
  qf:    { name: "Quartas de final",    multiplier: 2    },
  sf:    { name: "Semifinais",          multiplier: 2.5  },
  third: { name: "Disputa de 3º lugar", multiplier: 2.5  },
  final: { name: "Final",               multiplier: 3    },
};

const MATCHES = [
  // ===== Grupo A =====
  { id: 1,  phase: "group", group: "A", home: "México",               away: "África do Sul",        kickoff: "2026-06-11T16:00:00-03:00", venue: "Estadio Azteca, Cidade do México" },
  { id: 2,  phase: "group", group: "A", home: "Coreia do Sul",        away: "Tchéquia",             kickoff: "2026-06-11T23:00:00-03:00", venue: "Estadio Akron, Zapopan" },
  { id: 3,  phase: "group", group: "A", home: "Tchéquia",             away: "África do Sul",        kickoff: "2026-06-18T13:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 4,  phase: "group", group: "A", home: "México",               away: "Coreia do Sul",        kickoff: "2026-06-18T22:00:00-03:00", venue: "Estadio Akron, Zapopan" },
  { id: 5,  phase: "group", group: "A", home: "Tchéquia",             away: "México",               kickoff: "2026-06-24T22:00:00-03:00", venue: "Estadio Azteca, Cidade do México" },
  { id: 6,  phase: "group", group: "A", home: "África do Sul",        away: "Coreia do Sul",        kickoff: "2026-06-24T22:00:00-03:00", venue: "Estadio BBVA, Guadalupe" },

  // ===== Grupo B =====
  { id: 7,  phase: "group", group: "B", home: "Canadá",               away: "Bósnia e Herzegovina", kickoff: "2026-06-12T16:00:00-03:00", venue: "BMO Field, Toronto" },
  { id: 8,  phase: "group", group: "B", home: "Catar",                away: "Suíça",                kickoff: "2026-06-13T16:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },
  { id: 9,  phase: "group", group: "B", home: "Suíça",                away: "Bósnia e Herzegovina", kickoff: "2026-06-18T16:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 10, phase: "group", group: "B", home: "Canadá",               away: "Catar",                kickoff: "2026-06-18T19:00:00-03:00", venue: "BC Place, Vancouver" },
  { id: 11, phase: "group", group: "B", home: "Suíça",                away: "Canadá",               kickoff: "2026-06-24T16:00:00-03:00", venue: "BC Place, Vancouver" },
  { id: 12, phase: "group", group: "B", home: "Bósnia e Herzegovina", away: "Catar",                kickoff: "2026-06-24T16:00:00-03:00", venue: "Lumen Field, Seattle" },

  // ===== Grupo C =====
  { id: 13, phase: "group", group: "C", home: "Brasil",               away: "Marrocos",             kickoff: "2026-06-13T19:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 14, phase: "group", group: "C", home: "Haiti",                away: "Escócia",              kickoff: "2026-06-13T22:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 15, phase: "group", group: "C", home: "Escócia",              away: "Marrocos",             kickoff: "2026-06-19T19:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 16, phase: "group", group: "C", home: "Brasil",               away: "Haiti",                kickoff: "2026-06-19T21:30:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 17, phase: "group", group: "C", home: "Escócia",              away: "Brasil",               kickoff: "2026-06-24T19:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 18, phase: "group", group: "C", home: "Marrocos",             away: "Haiti",                kickoff: "2026-06-24T19:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },

  // ===== Grupo D =====
  { id: 19, phase: "group", group: "D", home: "Estados Unidos",       away: "Paraguai",             kickoff: "2026-06-12T22:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 20, phase: "group", group: "D", home: "Austrália",            away: "Turquia",              kickoff: "2026-06-14T01:00:00-03:00", venue: "BC Place, Vancouver" },
  { id: 21, phase: "group", group: "D", home: "Estados Unidos",       away: "Austrália",            kickoff: "2026-06-19T16:00:00-03:00", venue: "Lumen Field, Seattle" },
  { id: 22, phase: "group", group: "D", home: "Turquia",              away: "Paraguai",             kickoff: "2026-06-20T00:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },
  { id: 23, phase: "group", group: "D", home: "Turquia",              away: "Estados Unidos",       kickoff: "2026-06-25T23:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 24, phase: "group", group: "D", home: "Paraguai",             away: "Austrália",            kickoff: "2026-06-25T23:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },

  // ===== Grupo E =====
  { id: 25, phase: "group", group: "E", home: "Alemanha",             away: "Curaçao",              kickoff: "2026-06-14T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 26, phase: "group", group: "E", home: "Costa do Marfim",      away: "Equador",              kickoff: "2026-06-14T20:00:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 27, phase: "group", group: "E", home: "Alemanha",             away: "Costa do Marfim",      kickoff: "2026-06-20T17:00:00-03:00", venue: "BMO Field, Toronto" },
  { id: 28, phase: "group", group: "E", home: "Equador",              away: "Curaçao",              kickoff: "2026-06-20T21:00:00-03:00", venue: "Arrowhead Stadium, Kansas City" },
  { id: 29, phase: "group", group: "E", home: "Curaçao",              away: "Costa do Marfim",      kickoff: "2026-06-25T17:00:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 30, phase: "group", group: "E", home: "Equador",              away: "Alemanha",             kickoff: "2026-06-25T17:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },

  // ===== Grupo F =====
  { id: 31, phase: "group", group: "F", home: "Países Baixos",        away: "Japão",                kickoff: "2026-06-14T17:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 32, phase: "group", group: "F", home: "Suécia",               away: "Tunísia",              kickoff: "2026-06-14T23:00:00-03:00", venue: "Estadio BBVA, Guadalupe" },
  { id: 33, phase: "group", group: "F", home: "Países Baixos",        away: "Suécia",               kickoff: "2026-06-20T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 34, phase: "group", group: "F", home: "Tunísia",              away: "Japão",                kickoff: "2026-06-21T01:00:00-03:00", venue: "Estadio BBVA, Guadalupe" },
  { id: 35, phase: "group", group: "F", home: "Japão",                away: "Suécia",               kickoff: "2026-06-25T20:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 36, phase: "group", group: "F", home: "Tunísia",              away: "Países Baixos",        kickoff: "2026-06-25T20:00:00-03:00", venue: "Arrowhead Stadium, Kansas City" },

  // ===== Grupo G =====
  { id: 37, phase: "group", group: "G", home: "Bélgica",              away: "Egito",                kickoff: "2026-06-15T16:00:00-03:00", venue: "Lumen Field, Seattle" },
  { id: 38, phase: "group", group: "G", home: "Irã",                  away: "Nova Zelândia",        kickoff: "2026-06-15T22:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 39, phase: "group", group: "G", home: "Bélgica",              away: "Irã",                  kickoff: "2026-06-21T16:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 40, phase: "group", group: "G", home: "Nova Zelândia",        away: "Egito",                kickoff: "2026-06-21T22:00:00-03:00", venue: "BC Place, Vancouver" },
  { id: 41, phase: "group", group: "G", home: "Egito",                away: "Irã",                  kickoff: "2026-06-27T00:00:00-03:00", venue: "Lumen Field, Seattle" },
  { id: 42, phase: "group", group: "G", home: "Nova Zelândia",        away: "Bélgica",              kickoff: "2026-06-27T00:00:00-03:00", venue: "BC Place, Vancouver" },

  // ===== Grupo H =====
  { id: 43, phase: "group", group: "H", home: "Espanha",              away: "Cabo Verde",           kickoff: "2026-06-15T13:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 44, phase: "group", group: "H", home: "Arábia Saudita",       away: "Uruguai",              kickoff: "2026-06-15T19:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 45, phase: "group", group: "H", home: "Espanha",              away: "Arábia Saudita",       kickoff: "2026-06-21T13:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 46, phase: "group", group: "H", home: "Uruguai",              away: "Cabo Verde",           kickoff: "2026-06-21T19:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 47, phase: "group", group: "H", home: "Cabo Verde",           away: "Arábia Saudita",       kickoff: "2026-06-26T21:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 48, phase: "group", group: "H", home: "Uruguai",              away: "Espanha",              kickoff: "2026-06-26T21:00:00-03:00", venue: "Estadio Akron, Zapopan" },

  // ===== Grupo I =====
  { id: 49, phase: "group", group: "I", home: "França",               away: "Senegal",              kickoff: "2026-06-16T16:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 50, phase: "group", group: "I", home: "Iraque",               away: "Noruega",              kickoff: "2026-06-16T19:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 51, phase: "group", group: "I", home: "França",               away: "Iraque",               kickoff: "2026-06-22T18:00:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 52, phase: "group", group: "I", home: "Noruega",              away: "Senegal",              kickoff: "2026-06-22T21:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 53, phase: "group", group: "I", home: "Noruega",              away: "França",               kickoff: "2026-06-26T16:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 54, phase: "group", group: "I", home: "Senegal",              away: "Iraque",               kickoff: "2026-06-26T16:00:00-03:00", venue: "BMO Field, Toronto" },

  // ===== Grupo J =====
  { id: 55, phase: "group", group: "J", home: "Argentina",            away: "Argélia",              kickoff: "2026-06-16T22:00:00-03:00", venue: "Arrowhead Stadium, Kansas City" },
  { id: 56, phase: "group", group: "J", home: "Áustria",              away: "Jordânia",             kickoff: "2026-06-17T01:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },
  { id: 57, phase: "group", group: "J", home: "Argentina",            away: "Áustria",              kickoff: "2026-06-22T14:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 58, phase: "group", group: "J", home: "Jordânia",             away: "Argélia",              kickoff: "2026-06-23T00:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },
  { id: 59, phase: "group", group: "J", home: "Argélia",              away: "Áustria",              kickoff: "2026-06-27T23:00:00-03:00", venue: "Arrowhead Stadium, Kansas City" },
  { id: 60, phase: "group", group: "J", home: "Jordânia",             away: "Argentina",            kickoff: "2026-06-27T23:00:00-03:00", venue: "AT&T Stadium, Arlington" },

  // ===== Grupo K =====
  { id: 61, phase: "group", group: "K", home: "Portugal",             away: "RD Congo",             kickoff: "2026-06-17T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 62, phase: "group", group: "K", home: "Uzbequistão",          away: "Colômbia",             kickoff: "2026-06-17T23:00:00-03:00", venue: "Estadio Azteca, Cidade do México" },
  { id: 63, phase: "group", group: "K", home: "Portugal",             away: "Uzbequistão",          kickoff: "2026-06-23T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 64, phase: "group", group: "K", home: "Colômbia",             away: "RD Congo",             kickoff: "2026-06-23T23:00:00-03:00", venue: "Estadio Akron, Zapopan" },
  { id: 65, phase: "group", group: "K", home: "Colômbia",             away: "Portugal",             kickoff: "2026-06-27T20:30:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 66, phase: "group", group: "K", home: "RD Congo",             away: "Uzbequistão",          kickoff: "2026-06-27T20:30:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },

  // ===== Grupo L =====
  { id: 67, phase: "group", group: "L", home: "Inglaterra",           away: "Croácia",              kickoff: "2026-06-17T17:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 68, phase: "group", group: "L", home: "Gana",                 away: "Panamá",               kickoff: "2026-06-17T20:00:00-03:00", venue: "BMO Field, Toronto" },
  { id: 69, phase: "group", group: "L", home: "Inglaterra",           away: "Gana",                 kickoff: "2026-06-23T17:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 70, phase: "group", group: "L", home: "Panamá",               away: "Croácia",              kickoff: "2026-06-23T20:00:00-03:00", venue: "BMO Field, Toronto" },
  { id: 71, phase: "group", group: "L", home: "Panamá",               away: "Inglaterra",           kickoff: "2026-06-27T18:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 72, phase: "group", group: "L", home: "Croácia",              away: "Gana",                 kickoff: "2026-06-27T18:00:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },

  // ===== 16 avos de final (Round of 32) — times definidos após a fase de grupos =====
  { id: 73, phase: "r32", group: null, home: "2º A",  away: "2º B",              kickoff: "2026-06-28T16:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 74, phase: "r32", group: null, home: "1º E",  away: "3º A/B/C/D/F",      kickoff: "2026-06-29T17:30:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 75, phase: "r32", group: null, home: "1º F",  away: "2º C",              kickoff: "2026-06-29T22:00:00-03:00", venue: "Estadio BBVA, Guadalupe" },
  { id: 76, phase: "r32", group: null, home: "1º C",  away: "2º F",              kickoff: "2026-06-29T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 77, phase: "r32", group: null, home: "1º I",  away: "3º C/D/F/G/H",      kickoff: "2026-06-30T18:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 78, phase: "r32", group: null, home: "2º E",  away: "2º I",              kickoff: "2026-06-30T14:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 79, phase: "r32", group: null, home: "1º A",  away: "3º C/E/F/H/I",      kickoff: "2026-06-30T22:00:00-03:00", venue: "Estadio Azteca, Cidade do México" },
  { id: 80, phase: "r32", group: null, home: "1º L",  away: "3º E/H/I/J/K",      kickoff: "2026-07-01T13:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 81, phase: "r32", group: null, home: "1º D",  away: "3º B/E/F/I/J",      kickoff: "2026-07-01T21:00:00-03:00", venue: "Levi's Stadium, Santa Clara" },
  { id: 82, phase: "r32", group: null, home: "1º G",  away: "3º A/E/H/I/J",      kickoff: "2026-07-01T17:00:00-03:00", venue: "Lumen Field, Seattle" },
  { id: 83, phase: "r32", group: null, home: "2º K",  away: "2º L",              kickoff: "2026-07-02T20:00:00-03:00", venue: "BMO Field, Toronto" },
  { id: 84, phase: "r32", group: null, home: "1º H",  away: "2º J",              kickoff: "2026-07-02T16:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 85, phase: "r32", group: null, home: "1º B",  away: "3º E/F/G/I/J",      kickoff: "2026-07-03T00:00:00-03:00", venue: "BC Place, Vancouver" },
  { id: 86, phase: "r32", group: null, home: "1º J",  away: "2º H",              kickoff: "2026-07-03T19:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 87, phase: "r32", group: null, home: "1º K",  away: "3º D/E/I/J/L",      kickoff: "2026-07-03T22:30:00-03:00", venue: "Arrowhead Stadium, Kansas City" },
  { id: 88, phase: "r32", group: null, home: "2º D",  away: "2º G",              kickoff: "2026-07-03T15:00:00-03:00", venue: "AT&T Stadium, Arlington" },

  // ===== Oitavas de final (Round of 16) =====
  { id: 89, phase: "r16", group: null, home: "Ven. J74", away: "Ven. J77",       kickoff: "2026-07-04T18:00:00-03:00", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 90, phase: "r16", group: null, home: "Ven. J73", away: "Ven. J75",       kickoff: "2026-07-04T14:00:00-03:00", venue: "NRG Stadium, Houston" },
  { id: 91, phase: "r16", group: null, home: "Ven. J76", away: "Ven. J78",       kickoff: "2026-07-05T17:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
  { id: 92, phase: "r16", group: null, home: "Ven. J79", away: "Ven. J80",       kickoff: "2026-07-05T21:00:00-03:00", venue: "Estadio Azteca, Cidade do México" },
  { id: 93, phase: "r16", group: null, home: "Ven. J83", away: "Ven. J84",       kickoff: "2026-07-06T16:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 94, phase: "r16", group: null, home: "Ven. J81", away: "Ven. J82",       kickoff: "2026-07-06T21:00:00-03:00", venue: "Lumen Field, Seattle" },
  { id: 95, phase: "r16", group: null, home: "Ven. J86", away: "Ven. J88",       kickoff: "2026-07-07T13:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 96, phase: "r16", group: null, home: "Ven. J85", away: "Ven. J87",       kickoff: "2026-07-07T17:00:00-03:00", venue: "BC Place, Vancouver" },

  // ===== Quartas de final (Quarter-finals) =====
  { id: 97,  phase: "qf", group: null, home: "Ven. J89", away: "Ven. J90",       kickoff: "2026-07-09T17:00:00-03:00", venue: "Gillette Stadium, Foxborough" },
  { id: 98,  phase: "qf", group: null, home: "Ven. J93", away: "Ven. J94",       kickoff: "2026-07-10T16:00:00-03:00", venue: "SoFi Stadium, Inglewood" },
  { id: 99,  phase: "qf", group: null, home: "Ven. J91", away: "Ven. J92",       kickoff: "2026-07-11T18:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },
  { id: 100, phase: "qf", group: null, home: "Ven. J95", away: "Ven. J96",       kickoff: "2026-07-11T22:00:00-03:00", venue: "Arrowhead Stadium, Kansas City" },

  // ===== Semifinais (Semi-finals) =====
  { id: 101, phase: "sf", group: null, home: "Ven. J97", away: "Ven. J98",       kickoff: "2026-07-14T16:00:00-03:00", venue: "AT&T Stadium, Arlington" },
  { id: 102, phase: "sf", group: null, home: "Ven. J99", away: "Ven. J100",      kickoff: "2026-07-15T16:00:00-03:00", venue: "Mercedes-Benz Stadium, Atlanta" },

  // ===== Disputa de 3º lugar (Third place play-off) =====
  { id: 103, phase: "third", group: null, home: "Perd. J101", away: "Perd. J102", kickoff: "2026-07-18T18:00:00-03:00", venue: "Hard Rock Stadium, Miami Gardens" },

  // ===== Final =====
  { id: 104, phase: "final", group: null, home: "Ven. J101", away: "Ven. J102",  kickoff: "2026-07-19T16:00:00-03:00", venue: "MetLife Stadium, East Rutherford" },
];
