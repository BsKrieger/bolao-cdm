/* Testes do motor de pontuação / scoring engine tests.
   Abra tests/scoring.test.html no navegador para ver o resultado. */
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

  // ---- scoreMatch (com multiplicador) ----
  eq("32-avos exato ×1,25 = 12,5", Scoring.scoreMatch({ phase: "r32" }, { home: 1, away: 0 }, { home: 1, away: 0 }).total, 12.5);
  eq("semi: placar 8 + avanço 2 ×2,5 = 25", Scoring.scoreMatch({ phase: "sf" }, { home: 2, away: 0, advances: "home" }, { home: 3, away: 1, advances: "home" }).total, 25);
  eq("final exato ×3 = 30", Scoring.scoreMatch({ phase: "final" }, { home: 2, away: 1 }, { home: 2, away: 1 }).total, 30);
  eq("grupos exato ×1 = 10", Scoring.scoreMatch({ phase: "group" }, { home: 0, away: 0 }, { home: 0, away: 0 }).total, 10);

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
