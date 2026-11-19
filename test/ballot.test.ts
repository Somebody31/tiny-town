import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { closeBallot, initializeBallots, runNextJob } from "../src/ballot.js";

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  initializeBallots(db);
  return db;
}

function ballot(db: DatabaseSync, id: string, proposal: { law: number; kind: string; patch: number }): void {
  db.prepare("INSERT INTO ballots (id, closes_at) VALUES (?, ?)").run(id, "2026-11-20T00:00:00Z");
  db.prepare("INSERT INTO proposals (ballot_id, law_id, votes, proposal_kind, requires_patch) VALUES (?, ?, 3, ?, ?)")
    .run(id, proposal.law, proposal.kind, proposal.patch);
}

test("freeze close and blocked job happen once, repeal allows patches again", () => {
  const db = database();
  ballot(db, "50", { law: 50, kind: "code_freeze", patch: 0 });
  assert.equal(closeBallot(db, { ballotId: "50", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" }), 50);
  ballot(db, "51", { law: 51, kind: "law", patch: 1 });
  closeBallot(db, { ballotId: "51", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  assert.deepEqual({ ...db.prepare("SELECT status, attempts FROM jobs WHERE ballot_id = ?").get("51") }, { status: "blocked_by_law_50", attempts: 0 });
  assert.equal(runNextJob(db), null);
  assert.equal(closeBallot(db, { ballotId: "51", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" }), null);
  ballot(db, "52", { law: 52, kind: "repeal_freeze", patch: 0 });
  closeBallot(db, { ballotId: "52", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  ballot(db, "53", { law: 53, kind: "law", patch: 1 });
  closeBallot(db, { ballotId: "53", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  assert.equal(runNextJob(db)?.status, "complete");
  ballot(db, "54", { law: 54, kind: "law", patch: 1 });
  db.prepare("INSERT INTO proposals (ballot_id, law_id, votes, proposal_kind) VALUES ('54', 55, 3, 'law')").run();
  assert.equal(closeBallot(db, { ballotId: "54", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" }), null);
  assert.equal(db.prepare("SELECT tied_law_ids FROM runoffs WHERE ballot_id='54'").get()?.tied_law_ids, "[54,55]");
  ballot(db, "56", { law: 56, kind: "code_freeze", patch: 0 });
  closeBallot(db, { ballotId: "56", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  ballot(db, "57", { law: 57, kind: "repeal_freeze", patch: 0 });
  closeBallot(db, { ballotId: "57", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  ballot(db, "58", { law: 58, kind: "law", patch: 1 });
  closeBallot(db, { ballotId: "58", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  ballot(db, "59", { law: 59, kind: "code_freeze", patch: 0 });
  closeBallot(db, { ballotId: "59", currentCommit: "abc", yesterdaySnapshot: "{}", seed: "town" });
  assert.equal(runNextJob(db)?.status, "blocked_by_law_50");
  db.close();
});
