/**
 * @file Scoring engine tests / Testes do motor de pontuação.
 *
 * EN: Open tests/scoring.test.html in the browser to see the result.
 * PT-BR: Abra tests/scoring.test.html no navegador para ver o resultado.
 *
 * @author Bruno Krieger
 */
(function () {
  const cases = [];
  function eq(name, got, exp) { cases.push({ name, ok: got === exp, got, exp }); }

  // ---- scoreLine (pontos de placar) ----
  eq("placar exato = 10", Scoring.scoreLine({ home: 2, away: 1 }, { home: 2, away: 1 }), 10);
  eq("vencedor + saldo (placar errado) = 8", Scoring.scoreLine({ home: 2, away: 0 }, { home: 3, away: 1 }), 8);
  eq("vencedor sem saldo = 5", Scoring.scoreLine({ home: 2, away: 0 }, { home: 1, away: 0 }), 5);
  eq("empate placar errado = 8 (+3)", Scoring.scoreLine({ home: 1, away: 1 }, { home: 2, away: 2 }), 8);
  eq("empate exato = 10", Scoring.scoreLine({ home: 0, away: 0 }, { home: 0, away: 0 }), 10);
  eq("errou o resultado = 0", Scoring.scoreLine({ home: 2, away: 0 }, { home: 0, away: 1 }), 0);
  eq("sem palpite = 0", Scoring.scoreLine(null, { home: 1, away: 0 }), 0);

  // ---- scoreAdvance (quem avança) ----
  eq("avanço certo (oitavas) = 2", Scoring.scoreAdvance({ advances: "home" }, { advances: "home" }, "r16"), 2);
  eq("avanço errado (oitavas) = 0", Scoring.scoreAdvance({ advances: "home" }, { advances: "away" }, "r16"), 0);
  eq("avanço em grupos = 0", Scoring.scoreAdvance({ advances: "home" }, { advances: "home" }, "group"), 0);
  eq("avanço na final = 0", Scoring.scoreAdvance({ advances: "home" }, { advances: "home" }, "final"), 0);

  // ---- effectiveAdvance (avanço derivado do placar) ----
  eq("efetivo: vencedor home", Scoring.effectiveAdvance({ home: 1, away: 0 }), "home");
  eq("efetivo: vencedor away", Scoring.effectiveAdvance({ home: 0, away: 2 }), "away");
  eq("efetivo: empate usa a escolha", Scoring.effectiveAdvance({ home: 1, away: 1, advances: "away" }), "away");
  eq("efetivo: empate sem escolha = null", Scoring.effectiveAdvance({ home: 1, away: 1 }), null);
  eq("efetivo: placar vence a escolha oposta", Scoring.effectiveAdvance({ home: 1, away: 0, advances: "away" }), "home");
  eq("efetivo: sem placar usa a escolha", Scoring.effectiveAdvance({ advances: "home" }), "home");

  // ---- scoreAdvance derivado do placar (vencedor avança sozinho) ----
  eq("avanço derivado do placar = 2", Scoring.scoreAdvance({ home: 1, away: 0 }, { advances: "home" }, "r16"), 2);
  eq("avanço: placar vence escolha descasada = 2", Scoring.scoreAdvance({ home: 1, away: 0, advances: "away" }, { advances: "home" }, "r16"), 2);
  eq("avanço: placar venceu mas passou o outro = 0", Scoring.scoreAdvance({ home: 1, away: 0 }, { advances: "away" }, "r16"), 0);
  eq("avanço: empate com escolha certa = 2", Scoring.scoreAdvance({ home: 1, away: 1, advances: "home" }, { advances: "home" }, "r16"), 2);
  eq("avanço: empate sem escolha = 0", Scoring.scoreAdvance({ home: 1, away: 1 }, { advances: "home" }, "r16"), 0);

  // ---- scoreMatch (com multiplicador) ----
  eq("16-avos exato ×1,25 = 12,5", Scoring.scoreMatch({ phase: "r32" }, { home: 1, away: 0 }, { home: 1, away: 0 }).total, 12.5);
  eq("semi: placar 8 + avanço 2 ×2,5 = 25", Scoring.scoreMatch({ phase: "sf" }, { home: 2, away: 0, advances: "home" }, { home: 3, away: 1, advances: "home" }).total, 25);
  eq("final exato ×3 = 30", Scoring.scoreMatch({ phase: "final" }, { home: 2, away: 1 }, { home: 2, away: 1 }).total, 30);
  eq("grupos exato ×1 = 10", Scoring.scoreMatch({ phase: "group" }, { home: 0, away: 0 }, { home: 0, away: 0 }).total, 10);
  eq("16-avos: exato 10 + avanço derivado 2 ×1,25 = 15", Scoring.scoreMatch({ phase: "r32" }, { home: 1, away: 0 }, { home: 1, away: 0, advances: "home" }).total, 15);

  const failed = cases.filter((c) => !c.ok);
  const lines = cases.map((c) =>
    (c.ok ? "✓ " : "✗ ") + c.name + (c.ok ? "" : ` (esperado ${c.exp}, obteve ${c.got})`)
  );
  const summary = { total: cases.length, pass: cases.length - failed.length, fail: failed.length, lines };
  if (typeof window !== "undefined") {
    window.__testSummary = summary;
    const out = document.getElementById("out");
    if (out) out.textContent = `Testes: ${summary.pass}/${summary.total} passaram\n\n` + lines.join("\n");
  }
})();
