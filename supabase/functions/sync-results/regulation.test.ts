/**
 * @file Tests for regulation-time score / Testes do placar do tempo regulamentar.
 *
 * EN: Run with `deno test` (no Node/Deno on the dev machine — these document the
 *     contract and run in CI / on the Supabase deploy). The fixtures come from a
 *     REAL ESPN response (2022 final, Argentina 2-2 France at 90', 3-3 a.e.t.,
 *     4-2 on penalties).
 * PT-BR: Rode com `deno test` (sem Node/Deno na máquina de dev — eles documentam
 *        o contrato e rodam no CI / no deploy do Supabase). Os dados vêm de uma
 *        resposta REAL da ESPN (final de 2022, Argentina 2-2 França nos 90',
 *        3-3 na prorrogação, 4-2 nos pênaltis).
 *
 * @author Bruno Krieger
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { regulationFromLinescores } from "./regulation.ts";

Deno.test("jogo normal de 90' soma 1º e 2º tempo", () => {
  assertEquals(regulationFromLinescores([{ displayValue: "2" }, { displayValue: "0" }]), 2);
});

Deno.test("com prorrogação: usa só os 90' (ignora prorrogação e pênaltis)", () => {
  // Argentina 2022: 1ºT=2, 2ºT=0, prorrog.=0+1, pênaltis=4 -> regulamentar = 2.
  assertEquals(
    regulationFromLinescores([
      { displayValue: "2" },
      { displayValue: "0" },
      { displayValue: "0" },
      { displayValue: "1" },
      { displayValue: "4" },
    ]),
    2,
  );
});

Deno.test("empate nos 90' decidido depois = 0", () => {
  // 0x0 nos 90' (1ºT=0, 2ºT=0); virou na prorrogação e pênaltis -> regulamentar = 0.
  assertEquals(
    regulationFromLinescores([
      { displayValue: "0" },
      { displayValue: "0" },
      { displayValue: "1" },
      { displayValue: "0" },
      { displayValue: "3" },
    ]),
    0,
  );
});

Deno.test("menos de 2 períodos -> null (dado incompleto)", () => {
  assertEquals(regulationFromLinescores([{ displayValue: "1" }]), null);
  assertEquals(regulationFromLinescores([]), null);
});

Deno.test("entrada ausente ou não-numérica -> null", () => {
  assertEquals(regulationFromLinescores(undefined), null);
  assertEquals(regulationFromLinescores(null), null);
  assertEquals(regulationFromLinescores([{ displayValue: "" }, { displayValue: "x" }]), null);
});
