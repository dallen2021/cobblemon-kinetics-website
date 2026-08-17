import { describe, expect, it } from "vitest";

import { evolutionPositionForDex, gen1EvolutionFamilies } from "./gen1-evolution";

describe("Gen 1 evolution model", () => {
  it("covers all 151 species once across exactly 78 imported families", () => {
    const members = gen1EvolutionFamilies.flatMap((family) => family.members);
    expect(gen1EvolutionFamilies).toHaveLength(78);
    expect(members).toHaveLength(151);
    expect(new Set(members).size).toBe(151);
    expect([...members].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 151 }, (_, index) => index + 1),
    );
  });

  it("models Eevee's three Gen 1 branches explicitly", () => {
    const eevee = gen1EvolutionFamilies.find((family) => family.members.includes(133));
    expect(eevee).toEqual({
      members: [133, 134, 135, 136],
      edges: [
        [133, 134],
        [133, 135],
        [133, 136],
      ],
    });
  });

  it("groups Hitmonlee and Hitmonchan without inventing an evolution edge", () => {
    const hitmons = gen1EvolutionFamilies.find((family) => family.members.includes(106));
    expect(hitmons).toEqual({ members: [106, 107], edges: [] });
    expect(evolutionPositionForDex(106).stageLabel).toBe("Standalone");
    expect(evolutionPositionForDex(107).stageLabel).toBe("Standalone");
  });

  it("derives Bulbasaur family stages from explicit edges", () => {
    expect(evolutionPositionForDex(1)).toMatchObject({ stageIndex: 1, stageLabel: "Stage 1" });
    expect(evolutionPositionForDex(2)).toMatchObject({ stageIndex: 2, stageLabel: "Stage 2" });
    expect(evolutionPositionForDex(3)).toMatchObject({ stageIndex: 3, stageLabel: "Stage 3" });
  });
});
