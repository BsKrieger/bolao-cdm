/**
 * @file Top-scorer extraction / Extração do artilheiro (puro, testável).
 *
 * EN: Pure helper to find the goals leader's athlete $ref in ESPN's "leaders"
 *     payload. Kept out of index.ts so it can be unit-tested without the Deno
 *     server side effects (env reads at import time).
 * PT-BR: Helper puro que acha o $ref do artilheiro (líder de gols) na resposta
 *        "leaders" da ESPN. Fica fora do index.ts para ser testável sem os
 *        efeitos colaterais do servidor Deno (leitura de env no import).
 *
 * @author Bruno Krieger
 */

/** Shape mínimo do payload de leaders / minimal leaders payload shape. */
interface LeadersPayload {
  categories?: Array<{
    name?: string;
    leaders?: Array<{ athlete?: { $ref?: string } }>;
  }>;
}

/**
 * The goals leader's (rank 1) athlete $ref, or null when absent.
 * $ref do atleta líder de gols (rank 1), ou null quando ausente.
 *
 * @param leaders - ESPN leaders payload / Resposta de leaders da ESPN.
 * @returns Athlete $ref URL or null / URL do $ref do atleta ou null.
 */
export function goalsLeaderRef(
  leaders: LeadersPayload | null | undefined,
): string | null {
  const cats = leaders?.categories ?? [];
  const cat = cats.find((c) => c.name === "goals");
  const ref = cat?.leaders?.[0]?.athlete?.$ref;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}
