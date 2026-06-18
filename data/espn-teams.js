/**
 * @file ESPN team names → português / Nomes de time da ESPN → PT-BR.
 *
 * EN: Shared map used by every client module that reads the ESPN API (lineups,
 *     groups & bracket). Keep it in sync with the same map in the Edge Function
 *     (sync-results), which is Deno and can't import this file.
 * PT-BR: Mapa compartilhado por todo módulo do cliente que lê a API da ESPN
 *        (escalações, grupos e chaveamento). Mantenha em sincronia com o mesmo
 *        mapa da Edge Function (sync-results), que é Deno e não importa este arquivo.
 *
 * @author Bruno Krieger
 */
const ESPN_TO_PT = {
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
