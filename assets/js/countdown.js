/**
 * @file Countdown + auto-lock / Contador regressivo + trava automática.
 *
 * EN: Refreshes every registered element once per second. When a match kicks
 *     off, it calls onLock(match) exactly once so the UI can lock the pick.
 * PT-BR: Atualiza os elementos a cada segundo. Quando o jogo começa (kickoff),
 *        chama onLock(match) UMA vez para a UI travar o palpite.
 *
 * @author Bruno Krieger
 */
const Countdown = (() => {
  /** @type {Array<{el: HTMLElement, match: Object, onLock?: Function, locked: boolean}>} */
  const watchers = []; // { el, match, onLock, locked }

  /**
   * Short human-readable remaining time (e.g. "2d 3h", "5m 12s").
   * Formata o tempo restante de forma curta (ex.: "2d 3h", "5m 12s").
   *
   * @param {number} ms - Milliseconds remaining / Milissegundos restantes.
   * @returns {string} Compact label / Rótulo compacto.
   */
  function format(ms) {
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  /**
   * One tick: updates every open watcher and locks the ones that just started.
   * Um "tick": atualiza cada watcher aberto e trava os que acabaram de começar.
   *
   * @returns {void}
   */
  function tick() {
    const now = Date.now();
    for (const w of watchers) {
      if (w.locked) continue;
      const diff = new Date(w.match.kickoff).getTime() - now;
      if (diff <= 0) {
        w.locked = true;
        w.el.innerHTML = '<i class="ti ti-lock" aria-hidden="true"></i> Fechado';
        if (w.onLock) w.onLock(w.match);
      } else {
        w.el.textContent = "fecha em " + format(diff);
      }
    }
  }

  /**
   * Registers an element to receive countdown updates for a match.
   * Registra um elemento para receber as atualizações do contador de um jogo.
   *
   * @param {HTMLElement} el - Target element / Elemento alvo.
   * @param {Object} match - Match with a `kickoff` ISO date / Jogo com `kickoff`.
   * @param {Function} [onLock] - Called once at kickoff / Chamado uma vez no início.
   * @returns {void}
   */
  function register(el, match, onLock) {
    watchers.push({ el, match, onLock, locked: false });
  }

  setInterval(tick, 1000);
  return { register, tick };
})();
