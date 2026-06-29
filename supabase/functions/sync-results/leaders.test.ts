/**
 * @file Tests for top-scorer extraction / Testes da extração do artilheiro.
 *
 * EN: Run with `deno test`. Fixtures mirror ESPN's "leaders" payload shape
 *     (categories[].leaders[].athlete.$ref).
 * PT-BR: Rode com `deno test`. Os dados imitam a resposta "leaders" da ESPN
 *        (categories[].leaders[].athlete.$ref).
 *
 * @author Bruno Krieger
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { goalsLeaderRef } from "./leaders.ts";

Deno.test("pega o $ref do líder de gols (rank 1)", () => {
  const payload = {
    categories: [
      { name: "assists", leaders: [{ athlete: { $ref: "http://x/assist/9" } }] },
      {
        name: "goals",
        leaders: [
          { athlete: { $ref: "http://x/athletes/1" } },
          { athlete: { $ref: "http://x/athletes/2" } },
        ],
      },
    ],
  };
  assertEquals(goalsLeaderRef(payload), "http://x/athletes/1");
});

Deno.test("sem categoria de gols -> null", () => {
  assertEquals(
    goalsLeaderRef({ categories: [{ name: "assists", leaders: [] }] }),
    null,
  );
});

Deno.test("categoria de gols vazia -> null", () => {
  assertEquals(
    goalsLeaderRef({ categories: [{ name: "goals", leaders: [] }] }),
    null,
  );
});

Deno.test("payload ausente ou sem $ref -> null", () => {
  assertEquals(goalsLeaderRef(null), null);
  assertEquals(goalsLeaderRef(undefined), null);
  assertEquals(goalsLeaderRef({}), null);
  assertEquals(
    goalsLeaderRef({ categories: [{ name: "goals", leaders: [{ athlete: {} }] }] }),
    null,
  );
});
