/* =========================================================================
   Contador regressivo + trava / Countdown + auto-lock
   ---------------------------------------------------------------------------
   Atualiza os elementos a cada segundo. Quando o jogo começa (kickoff),
   chama onLock(match) UMA vez para a UI travar o palpite.
   ========================================================================= */
const Countdown = (() => {
  const watchers = []; // { el, match, onLock, locked }

  // Formata o tempo restante de forma curta / short remaining-time format.
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

  function tick() {
    const now = Date.now();
    for (const w of watchers) {
      if (w.locked) continue;
      const diff = new Date(w.match.kickoff).getTime() - now;
      if (diff <= 0) {
        w.locked = true;
        w.el.textContent = "🔒 Fechado";
        if (w.onLock) w.onLock(w.match);
      } else {
        w.el.textContent = "fecha em " + format(diff);
      }
    }
  }

  function register(el, match, onLock) {
    watchers.push({ el, match, onLock, locked: false });
  }

  setInterval(tick, 1000);
  return { register, tick };
})();
