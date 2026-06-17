/**
 * @file UI animations / Animações da interface.
 *
 * EN: Additive — depends on no existing logic and changes no app behavior.
 *  - Marks .js-anim early (frees the hidden reveal state without a flash).
 *  - Scroll reveal (.reveal-on-scroll → .visible) via IntersectionObserver.
 *  - Navbar border on scroll (.topbar.is-scrolled).
 *  - Animated counters only where [data-count] exists (static numbers).
 *  Respects prefers-reduced-motion and fails safe (content stays visible).
 *
 * PT-BR: Aditivo — não depende de nenhuma lógica existente e não altera o app.
 *  - Marca .js-anim cedo (libera o estado oculto do reveal sem "flash").
 *  - Reveal no scroll (.reveal-on-scroll → .visible) via IntersectionObserver.
 *  - Borda da navbar ao rolar (.topbar.is-scrolled).
 *  - Contadores animados só onde houver [data-count] (números estáticos).
 *  Respeita prefers-reduced-motion e falha de forma segura (conteúdo visível).
 *
 * @author Bruno Krieger
 */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sinaliza que o JS de animação está ativo. Se este arquivo não carregar, o
  // CSS de reveal nem entra em ação e o conteúdo aparece normalmente.
  // Flags that the animation JS is active; otherwise reveal CSS never kicks in.
  if (!reduce) docEl.classList.add("js-anim");

  /**
   * Runs a callback when the DOM is ready.
   * Executa um callback quando o DOM está pronto.
   *
   * @param {Function} fn - Callback / Função de retorno.
   * @returns {void}
   */
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /**
   * Adds .is-scrolled to the navbar once the page is scrolled a bit.
   * Adiciona .is-scrolled à navbar quando a página rola um pouco.
   *
   * @returns {void}
   */
  function setupScrollState() {
    var bar = document.querySelector(".topbar");
    if (!bar) return;
    var update = function () {
      bar.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /**
   * Reveals .reveal-on-scroll elements as they enter the viewport. Falls back to
   * showing everything when reduced motion or no IntersectionObserver.
   * Revela os .reveal-on-scroll ao entrarem na viewport. Mostra tudo de imediato
   * quando há redução de movimento ou sem IntersectionObserver.
   *
   * @returns {void}
   */
  function setupReveal() {
    var els = document.querySelectorAll(".reveal-on-scroll");
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      forEach(els, function (el) { el.classList.add("visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      forEach(entries, function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    forEach(els, function (el) { io.observe(el); });
  }

  /**
   * Counts an element up to its [data-count] target (ease-out cubic). Honors
   * [data-prefix], [data-suffix] and [data-format="thousands"].
   * Anima um elemento até o alvo [data-count] (ease-out cúbico). Respeita
   * [data-prefix], [data-suffix] e [data-format="thousands"].
   *
   * @param {HTMLElement} el - Element with [data-count] / Elemento com [data-count].
   * @returns {void}
   */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var grouped = el.getAttribute("data-format") === "thousands";
    var fmt = function (n) {
      var v = grouped
        ? Math.round(n).toLocaleString("pt-BR")
        : String(Math.round(n));
      return prefix + v + suffix;
    };
    if (reduce) { el.textContent = fmt(target); return; }
    var dur = 1200, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico / cubic ease-out
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  /**
   * Animates every [data-count] when it scrolls into view (or immediately on
   * reduced motion / no IntersectionObserver).
   * Anima cada [data-count] ao entrar na viewport (ou de imediato com redução de
   * movimento / sem IntersectionObserver).
   *
   * @returns {void}
   */
  function setupCounters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      forEach(els, animateCount);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      forEach(entries, function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    forEach(els, function (el) { io.observe(el); });
  }

  /**
   * Iterates a NodeList/array without depending on a polyfill.
   * Itera NodeList/array sem depender de polyfill.
   *
   * @param {ArrayLike} list - Items / Itens.
   * @param {Function} fn - Callback / Função de retorno.
   * @returns {void}
   */
  function forEach(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  onReady(function () {
    setupScrollState();
    setupReveal();
    setupCounters();
  });
})();
