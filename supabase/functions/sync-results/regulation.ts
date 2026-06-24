/**
 * @file Regulation-time score / Placar do tempo regulamentar.
 *
 * EN: Pure helper for the results sync. ESPN's `summary` endpoint exposes a
 *     per-period `linescores` array; the first two entries are the 1st and 2nd
 *     half. Their sum is the score at the end of regulation (90'), which is what
 *     the pool scores against — extra time and penalties never count as goals
 *     here (penalties only decide "advances").
 * PT-BR: Helper puro para o sync de resultados. O endpoint `summary` da ESPN
 *        traz um array `linescores` por período; os dois primeiros são 1º e 2º
 *        tempo. A soma é o placar ao fim do tempo regulamentar (90'), que é o
 *        que o bolão pontua — prorrogação e pênaltis nunca contam como gol aqui
 *        (pênaltis só decidem o "advances").
 *
 * @author Bruno Krieger
 */

/** One scoring period as ESPN returns it / Um período como a ESPN devolve. */
export interface LineScore {
  displayValue?: string;
}

/**
 * Sums the first two periods (1st + 2nd half) = regulation-time goals.
 * Returns null when the data is missing or non-numeric, so the caller skips the
 * row instead of saving a wrong score (never swallow a bad result silently).
 *
 * Soma os dois primeiros períodos (1º + 2º tempo) = gols no tempo regulamentar.
 * Devolve null quando o dado falta ou não é numérico, para quem chama pular a
 * linha em vez de gravar um placar errado (nunca engolir um resultado ruim).
 *
 * @param linescores - Per-period scores / Placares por período.
 * @returns Regulation goals, or null / Gols no regulamentar, ou null.
 */
export function regulationFromLinescores(
  linescores?: LineScore[] | null,
): number | null {
  if (!Array.isArray(linescores) || linescores.length < 2) return null;
  const first = parseInt(linescores[0]?.displayValue ?? "", 10);
  const second = parseInt(linescores[1]?.displayValue ?? "", 10);
  if (Number.isNaN(first) || Number.isNaN(second)) return null;
  return first + second;
}
