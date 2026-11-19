export type Scope = "everyone" | "station-staff";
export type HatRule = "fine-platform-hat" | "staff-hard-hats-required" | "staff-hard-hats-optional";

export interface Law {
  id: number;
  enactedAt: number;
  scope: Scope;
  rule: HatRule;
}

export interface Ruling {
  lawId: number;
  outcome: "fine" | "allow";
}

export function ruleForBoarding(laws: Law[], resident: { role: "station-staff" | "passenger"; wearsHardHat: boolean }): Ruling | undefined {
  const applicable = laws.filter((law) => law.scope === "everyone" || resident.role === "station-staff");
  applicable.sort((left, right) => {
    const scopePriority = Number(left.scope === "station-staff") - Number(right.scope === "station-staff");
    return scopePriority || left.enactedAt - right.enactedAt || left.id - right.id;
  });
  const highestScope = applicable.at(-1)?.scope;
  const winner = applicable.filter((law) => law.scope === highestScope).sort((a, b) => b.enactedAt - a.enactedAt || b.id - a.id)[0];
  if (!winner) return undefined;
  if (winner.rule === "fine-platform-hat") return { lawId: winner.id, outcome: resident.wearsHardHat ? "fine" : "allow" };
  return { lawId: winner.id, outcome: winner.rule === "staff-hard-hats-required" && !resident.wearsHardHat ? "fine" : "allow" };
}
