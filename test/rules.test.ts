import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ruleForBoarding, type Law } from "../src/rules.js";

describe("boarding law precedence", () => {
  const laws: Law[] = [
    { id: 4, enactedAt: 4, scope: "everyone", rule: "fine-platform-hat" },
    { id: 9, enactedAt: 9, scope: "station-staff", rule: "staff-hard-hats-required" },
  ];

  it("lets a conductor board under the staff law and fines a passenger under law 4", () => {
    assert.deepEqual(ruleForBoarding(laws, { role: "station-staff", wearsHardHat: true }), { lawId: 9, outcome: "allow" });
    assert.deepEqual(ruleForBoarding(laws, { role: "passenger", wearsHardHat: true }), { lawId: 4, outcome: "fine" });
  });

  it("uses newer identical-scope laws while staff scope beats later general law", () => {
    const extended = [...laws,
      { id: 12, enactedAt: 12, scope: "station-staff" as const, rule: "staff-hard-hats-optional" as const },
      { id: 13, enactedAt: 13, scope: "everyone" as const, rule: "fine-platform-hat" as const },
    ];
    assert.deepEqual(ruleForBoarding(extended, { role: "station-staff", wearsHardHat: true }), { lawId: 12, outcome: "allow" });
    assert.deepEqual(ruleForBoarding(extended, { role: "passenger", wearsHardHat: true }), { lawId: 13, outcome: "fine" });
  });
});
