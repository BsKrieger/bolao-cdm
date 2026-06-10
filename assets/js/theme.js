/* =========================================================================
   Tema claro/escuro / Light-dark theme
   - Escuro é o padrão. A escolha fica salva no navegador.
   - Aplica o tema cedo (no <head>) pra não piscar; injeta o botão no topo.
   ========================================================================= */
(function () {
  const KEY = "bolaocdm:theme";
  const current = () => localStorage.getItem(KEY) || "dark";
  const apply = (t) => { document.documentElement.dataset.theme = t; };

  apply(current()); // aplica antes da página pintar (evita flash)

  function refreshButton() {
    const b = document.getElementById("themeToggle");
    if (!b) return;
    const dark = current() === "dark";
    b.textContent = dark ? "☀️" : "🌙";
    const label = dark ? "Mudar para modo claro" : "Mudar para modo escuro";
    b.title = label;
    b.setAttribute("aria-label", label);
  }

  function toggle() {
    localStorage.setItem(KEY, current() === "dark" ? "light" : "dark");
    apply(current());
    refreshButton();
  }

  function injectButton() {
    const bar = document.querySelector(".topbar");
    if (!bar || document.getElementById("themeToggle")) return;
    const b = document.createElement("button");
    b.id = "themeToggle";
    b.type = "button";
    b.className = "theme-toggle";
    b.addEventListener("click", toggle);
    bar.appendChild(b);
    refreshButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
