import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runStation, explainBlockedGate } from './station.js';
import { initializeBallots, closeBallot, runNextJob } from './ballot.js';

const db = new DatabaseSync('tiny-town.sqlite');
if (process.argv[2] === 'explain') {
  const row = db.prepare('SELECT MAX(id) AS id FROM runs').get();
  if (!row?.id) throw new Error('Run npm run demo first');
  console.log(explainBlockedGate(db, Number(row.id)).join('\n'));
} else {
  const events = runStation(db);
  const headline = events.find(event => event.kind === 'train_delayed');
  console.log(`The Platform Gazette: ${headline?.detail ?? '08:05 boards on time'}.`);
  console.log('Tonight: Does a hat on a coat hook count as being on the ground?');
  initializeBallots(db);
  const ballotId = `sample-${Date.now()}`;
  db.prepare('INSERT INTO ballots(id, closes_at) VALUES (?, ?)').run(ballotId, '2026-01-01T00:00:00Z');
  db.prepare("INSERT INTO proposals(ballot_id,law_id,votes,proposal_kind,requires_patch) VALUES (?,9,1,'law',1)").run(ballotId);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  closeBallot(db, { ballotId, currentCommit: commit, yesterdaySnapshot: JSON.stringify({ hats: 14 }), seed: '3105' });
  console.log(`Local job: ${JSON.stringify(runNextJob(db))}`);
  console.log(`\nDevin task preview\nBase commit: ${commit}\nReplay fixture: 14 hats on Platform 3, seed 3105\n` + readFileSync('docs/devin-task.md', 'utf8'));
}
db.close();
