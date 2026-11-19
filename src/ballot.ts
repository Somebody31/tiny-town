import { DatabaseSync } from "node:sqlite";

export function initializeBallots(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS town_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      code_frozen INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO town_state (id, code_frozen) VALUES (1, 0);
    CREATE TABLE IF NOT EXISTS ballots (
      id TEXT PRIMARY KEY,
      closes_at TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      winner_law_id INTEGER,
      current_commit TEXT,
      yesterday_snapshot TEXT,
      simulation_seed TEXT
    );
    CREATE TABLE IF NOT EXISTS proposals (
      ballot_id TEXT NOT NULL REFERENCES ballots(id),
      law_id INTEGER NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0,
      proposal_kind TEXT NOT NULL CHECK (proposal_kind IN ('law', 'code_freeze', 'repeal_freeze')),
      requires_patch INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ballot_id, law_id)
    );
    CREATE TABLE IF NOT EXISTS jobs (
      ballot_id TEXT PRIMARY KEY REFERENCES ballots(id),
      law_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'blocked_by_law_50', 'complete')),
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS runoffs (
      ballot_id TEXT PRIMARY KEY REFERENCES ballots(id),
      tied_law_ids TEXT NOT NULL
    );
  `);
}

export function closeBallot(db: DatabaseSync, input: {
  ballotId: string;
  currentCommit: string;
  yesterdaySnapshot: string;
  seed: string;
}): number | null {
  db.exec("BEGIN IMMEDIATE");
  try {
    const ballot = db.prepare("SELECT processed FROM ballots WHERE id = ?").get(input.ballotId) as { processed: number } | undefined;
    if (!ballot) throw new Error(`Unknown ballot ${input.ballotId}`);
    if (ballot.processed) {
      db.exec("COMMIT");
      return null;
    }
    const leaders = db.prepare(`
      SELECT p.law_id, p.proposal_kind, p.requires_patch
      FROM proposals p
      WHERE p.ballot_id = ?
        AND p.votes = (SELECT MAX(votes) FROM proposals WHERE ballot_id = ?)
      ORDER BY p.law_id
    `).all(input.ballotId, input.ballotId) as { law_id: number; proposal_kind: string; requires_patch: number }[];
    if (!leaders.length) throw new Error("Cannot close a ballot without proposals");
    if (leaders.length > 1) {
      db.prepare("INSERT INTO runoffs (ballot_id, tied_law_ids) VALUES (?, ?)").run(input.ballotId, JSON.stringify(leaders.map((law) => law.law_id)));
      db.prepare("UPDATE ballots SET processed=1, current_commit=?, yesterday_snapshot=?, simulation_seed=? WHERE id=?")
        .run(input.currentCommit, input.yesterdaySnapshot, input.seed, input.ballotId);
      db.prepare("INSERT INTO jobs (ballot_id, law_id, status) VALUES (?, ?, 'complete')").run(input.ballotId, leaders[0].law_id);
      db.exec("COMMIT");
      return null;
    }
    const winner = leaders[0];
    if (winner.proposal_kind === "code_freeze") db.prepare("UPDATE town_state SET code_frozen = 1 WHERE id = 1").run();
    if (winner.proposal_kind === "repeal_freeze") db.prepare("UPDATE town_state SET code_frozen = 0 WHERE id = 1").run();
    const frozen = (db.prepare("SELECT code_frozen FROM town_state WHERE id = 1").get() as { code_frozen: number }).code_frozen;
    db.prepare("UPDATE ballots SET processed=1, winner_law_id=?, current_commit=?, yesterday_snapshot=?, simulation_seed=? WHERE id=?")
      .run(winner.law_id, input.currentCommit, input.yesterdaySnapshot, input.seed, input.ballotId);
    const jobStatus = winner.proposal_kind !== "law" || !winner.requires_patch ? "complete" : frozen ? "blocked_by_law_50" : "pending";
    db.prepare("INSERT INTO jobs (ballot_id, law_id, status) VALUES (?, ?, ?)").run(input.ballotId, winner.law_id, jobStatus);
    db.exec("COMMIT");
    return winner.law_id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function runNextJob(db: DatabaseSync): { ballotId: string; lawId: number; status: string } | null {
  db.exec("BEGIN IMMEDIATE");
  const job = db.prepare("SELECT ballot_id, law_id, status FROM jobs WHERE status='pending' ORDER BY ballot_id LIMIT 1").get() as
    { ballot_id: string; law_id: number; status: string } | undefined;
  if (!job) { db.exec("COMMIT"); return null; }
  const frozen = (db.prepare("SELECT code_frozen FROM town_state WHERE id=1").get() as { code_frozen: number }).code_frozen;
  if (frozen) {
    db.prepare("UPDATE jobs SET status='blocked_by_law_50' WHERE ballot_id=? AND status='pending'").run(job.ballot_id);
    db.exec("COMMIT");
    return { ballotId: job.ballot_id, lawId: job.law_id, status: "blocked_by_law_50" };
  }
  db.prepare("UPDATE jobs SET status='complete' WHERE ballot_id=? AND status='pending'").run(job.ballot_id);
  db.exec("COMMIT");
  return { ballotId: job.ballot_id, lawId: job.law_id, status: "complete" };
}
