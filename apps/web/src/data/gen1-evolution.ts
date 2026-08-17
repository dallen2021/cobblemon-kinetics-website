export interface Gen1EvolutionFamilyDefinition {
  members: readonly number[];
  edges: readonly (readonly [number, number])[];
}

function linear(...members: number[]): Gen1EvolutionFamilyDefinition {
  return {
    members,
    edges: members.slice(1).map((member, index) => [members[index]!, member] as const),
  };
}

function standalone(member: number): Gen1EvolutionFamilyDefinition {
  return { members: [member], edges: [] };
}

export const gen1EvolutionFamilies: readonly Gen1EvolutionFamilyDefinition[] = [
  linear(1, 2, 3),
  linear(4, 5, 6),
  linear(7, 8, 9),
  linear(10, 11, 12),
  linear(13, 14, 15),
  linear(16, 17, 18),
  linear(19, 20),
  linear(21, 22),
  linear(23, 24),
  linear(25, 26),
  linear(27, 28),
  linear(29, 30, 31),
  linear(32, 33, 34),
  linear(35, 36),
  linear(37, 38),
  linear(39, 40),
  linear(41, 42),
  linear(43, 44, 45),
  linear(46, 47),
  linear(48, 49),
  linear(50, 51),
  linear(52, 53),
  linear(54, 55),
  linear(56, 57),
  linear(58, 59),
  linear(60, 61, 62),
  linear(63, 64, 65),
  linear(66, 67, 68),
  linear(69, 70, 71),
  linear(72, 73),
  linear(74, 75, 76),
  linear(77, 78),
  linear(79, 80),
  linear(81, 82),
  standalone(83),
  linear(84, 85),
  linear(86, 87),
  linear(88, 89),
  linear(90, 91),
  linear(92, 93, 94),
  standalone(95),
  linear(96, 97),
  linear(98, 99),
  linear(100, 101),
  linear(102, 103),
  linear(104, 105),
  { members: [106, 107], edges: [] },
  standalone(108),
  linear(109, 110),
  linear(111, 112),
  standalone(113),
  standalone(114),
  standalone(115),
  linear(116, 117),
  linear(118, 119),
  linear(120, 121),
  standalone(122),
  standalone(123),
  standalone(124),
  standalone(125),
  standalone(126),
  standalone(127),
  standalone(128),
  linear(129, 130),
  standalone(131),
  standalone(132),
  {
    members: [133, 134, 135, 136],
    edges: [
      [133, 134],
      [133, 135],
      [133, 136],
    ],
  },
  standalone(137),
  linear(138, 139),
  linear(140, 141),
  standalone(142),
  standalone(143),
  standalone(144),
  standalone(145),
  standalone(146),
  linear(147, 148, 149),
  standalone(150),
  standalone(151),
];

export interface Gen1EvolutionPosition {
  familyIndex: number;
  members: readonly number[];
  edges: readonly (readonly [number, number])[];
  stageIndex: number;
  stageLabel: "Stage 1" | "Stage 2" | "Stage 3" | "Standalone";
}

const positions = new Map<number, Gen1EvolutionPosition>();
for (const [familyIndex, family] of gen1EvolutionFamilies.entries()) {
  const stages = new Map<number, number>();
  const visit = (member: number): number => {
    const current = stages.get(member);
    if (current) return current;
    const parents = family.edges
      .filter(([, target]) => target === member)
      .map(([source]) => source);
    const stage = parents.length ? Math.max(...parents.map(visit)) + 1 : 1;
    stages.set(member, stage);
    return stage;
  };
  for (const member of family.members) {
    const stageIndex = visit(member);
    positions.set(member, {
      familyIndex,
      members: family.members,
      edges: family.edges,
      stageIndex,
      stageLabel:
        family.edges.length === 0
          ? "Standalone"
          : stageIndex === 1
            ? "Stage 1"
            : stageIndex === 2
              ? "Stage 2"
              : "Stage 3",
    });
  }
}

export function evolutionPositionForDex(dex: number): Gen1EvolutionPosition {
  const position = positions.get(dex);
  if (!position) throw new Error(`Missing Gen 1 evolution family for #${dex}.`);
  return position;
}
