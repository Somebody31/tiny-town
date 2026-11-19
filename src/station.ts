import { DatabaseSync } from 'node:sqlite';

export type Event = { sequence: number; minute: number; kind: string; detail: string; lawId: number | null };

export function runStation(db: DatabaseSync, hats = 14, seed = 3105): Event[] {
  db.exec(`CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, seed INTEGER, starting_snapshot TEXT);
    CREATE TABLE IF NOT EXISTS laws(id INTEGER PRIMARY KEY, enacted_day INTEGER, text TEXT);
    CREATE TABLE IF NOT EXISTS run_laws(run_id INTEGER, law_id INTEGER, enacted_day INTEGER, text TEXT);
    CREATE TABLE IF NOT EXISTS events(run_id INTEGER, sequence INTEGER, minute INTEGER, kind TEXT, detail TEXT, law_id INTEGER, PRIMARY KEY(run_id, sequence));`);
  const tx = db.prepare('INSERT INTO runs(seed, starting_snapshot) VALUES (?, ?)');
  const runId = Number(tx.run(seed, JSON.stringify({ hats, location: 'Platform 3', train: '08:05' })).lastInsertRowid);
  db.prepare('INSERT OR IGNORE INTO laws(id,enacted_day,text) VALUES (1,1,?),(2,2,?)').run('Ground hats grow into trees overnight', 'Passengers leave hats on Platform 3 before boarding');
  db.prepare('INSERT INTO run_laws SELECT ?,id,enacted_day,text FROM laws WHERE id IN (1,2)').run(runId);
  const insert = db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)');
  const events: Event[] = [];
  const record = (minute: number, kind: string, detail: string, lawId: number | null) => {
    const event = { sequence: events.length + 1, minute, kind, detail, lawId };
    events.push(event); insert.run(runId, event.sequence, minute, kind, detail, lawId);
  };
  let groundHats = 0;
  let trees = 0;
  for (let minute = 0; minute <= 1925; minute++) {
    if (minute === 1000) {
      groundHats = hats;
      record(minute, 'passengers_boarded', `${hats} passengers boarded and left hats on Platform 3`, 2);
    }
    if (minute === 1440) {
      trees = groundHats;
      record(minute, 'midnight_growth', `${groundHats} ground hats grew into trees`, 1);
    }
    if (minute === 1925 && trees > 0) {
      record(minute, 'boarding_blocked', `${trees} oaks blocked the Platform 3 gate at 08:05`, 1);
      record(minute, 'train_delayed', `08:05 delayed by ${trees} former hats`, 2);
    }
  }
  return events;
}

export function replayEvents(db: DatabaseSync, runId: number): Event[] {
  return db.prepare('SELECT sequence, minute, kind, detail, law_id AS lawId FROM events WHERE run_id=? ORDER BY sequence').all(runId).map(row => ({ ...row })) as Event[];
}

export function explainBlockedGate(db: DatabaseSync, runId: number): string[] {
  return db.prepare(`SELECT e.detail || ' [law ' || e.law_id || ': ' || l.text || ']' AS cause FROM events e JOIN run_laws l ON l.run_id=e.run_id AND l.law_id=e.law_id WHERE e.run_id=? AND e.kind IN ('passengers_boarded','midnight_growth','boarding_blocked','train_delayed') ORDER BY e.sequence`).all(runId).map(row => (row as {cause:string}).cause);
}
