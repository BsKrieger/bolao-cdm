/**
 * @file Knockout slot matching / Casamento dos jogos de mata-mata (puro, testável).
 *
 * EN: Our knockout matches are anchored ONLY by kickoff time (the teams are
 *     placeholders like "1º A" until the bracket fills). ESPN sometimes shifts a
 *     kickoff — e.g. a weather postponement — so an exact-time match is fragile:
 *     the finished game silently fails to map. We match to the NEAREST slot
 *     within a tolerance instead (same idea as ko-teams.js on the client). Pure,
 *     no Deno, so it can be unit-tested. Slots sit ≥3.5 h apart, so a ±90 min
 *     window is never ambiguous.
 * PT-BR: Nossos jogos de mata-mata são ancorados SÓ pelo horário (os times são
 *        vagas tipo "1º A" até a chave preencher). A ESPN às vezes remarca o
 *        kickoff — ex.: adiamento por chuva — então casar por horário exato é
 *        frágil: o jogo encerrado deixa de casar em silêncio. Casamos pelo slot
 *        MAIS PRÓXIMO dentro de uma tolerância (igual ao ko-teams.js no cliente).
 *        Puro, sem Deno, para ser testável. Os slots ficam ≥3,5 h separados,
 *        então uma janela de ±90 min nunca é ambígua.
 *
 * @author Bruno Krieger
 */

/** A knockout slot: kickoff (ms) + our id / vaga do mata-mata: horário (ms) + id. */
export interface KoSlot {
  ms: number;
  id: number;
}

/**
 * Nearest knockout slot id within tolerance, or undefined when none is close
 * enough. On ties, the last equally-close slot wins (irrelevant with real data,
 * where slots are hours apart).
 * Id do slot de mata-mata mais próximo dentro da tolerância, ou undefined quando
 * nenhum está perto o bastante.
 *
 * @param utcMs - Game kickoff in ms / Kickoff do jogo em ms.
 * @param slots - Candidate slots / Vagas candidatas.
 * @param toleranceMs - Max distance to accept / Distância máxima aceita.
 * @returns Slot id or undefined / Id do slot ou undefined.
 */
export function nearestKoId(
  utcMs: number,
  slots: KoSlot[],
  toleranceMs: number,
): number | undefined {
  let best: number | undefined;
  let bestD = toleranceMs;
  for (const s of slots) {
    const d = Math.abs(s.ms - utcMs);
    if (d <= bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}
