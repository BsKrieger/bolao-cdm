/**
 * @file Tests for knockout slot matching / Testes do casamento de mata-mata.
 *
 * EN: Run with `deno test`. Times are in ms from an arbitrary epoch.
 * PT-BR: Rode com `deno test`. Horários em ms a partir de uma época arbitrária.
 *
 * @author Bruno Krieger
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { KoSlot, nearestKoId } from "./komatch.ts";

const MIN = 60000;
const TOL = 90 * MIN;

// Dois slots afastados (~15 h), como no mundo real. / two far-apart slots.
const slots: KoSlot[] = [{ ms: 0, id: 79 }, { ms: 15 * 60 * MIN, id: 80 }];

Deno.test("horário exato casa o slot", () => {
  assertEquals(nearestKoId(0, slots, TOL), 79);
});

Deno.test("adiamento de 60 min ainda casa (dentro de 90)", () => {
  assertEquals(nearestKoId(60 * MIN, slots, TOL), 79);
});

Deno.test("exatamente 90 min casa (limite inclusivo)", () => {
  assertEquals(nearestKoId(90 * MIN, slots, TOL), 79);
});

Deno.test("91 min não casa (fora da tolerância)", () => {
  assertEquals(nearestKoId(91 * MIN, slots, TOL), undefined);
});

Deno.test("escolhe o slot mais próximo entre dois candidatos", () => {
  const two: KoSlot[] = [{ ms: 0, id: 1 }, { ms: 100 * MIN, id: 2 }];
  assertEquals(nearestKoId(80 * MIN, two, TOL), 2); // 20 min do id2 vs 80 min do id1
});

Deno.test("sem slots -> undefined", () => {
  assertEquals(nearestKoId(0, [], TOL), undefined);
});
