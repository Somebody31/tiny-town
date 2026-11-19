# Tiny Town

Tiny Town is a 100-day experiment in local government. Each day residents vote on a proposed law. Laws remain in force until repealed, and their interactions shape the next morning's Platform Gazette.

## Run locally

Use Node.js 24 or later and npm. No account or API key is needed.

```sh
npm ci
npm test
npm run demo
npm run explain
```

The demo saves runs and sample ballot jobs in `tiny-town.sqlite`. The explain command reads the latest run and lists the events and laws behind its blocked gate. Delete that file to start with a fresh local database. Change the hat count passed to `runStation` in `src/cli.ts` to try another fixture.

## What works

- A minute-by-minute station scenario records passengers leaving hats, midnight growth, and the 08:05 delay. The Gazette headline comes from the recorded delay event.
- SQLite stores the starting snapshot, seed, active law versions and ordered events. Tests compare repeated runs and read the event ledger.
- Boarding rulings give staff rules priority over general rules, then select the newer law within the same scope. The result includes the law ID.
- A local sample ballot closes transactionally and prints a proposed Devin task. Ballot metadata records the Git commit, snapshot and seed. A durable job is associated with the winning ballot.
- A code-freeze ballot and its processed state commit together. Patch jobs are blocked by law 50 while frozen. A repeal clears the flag. The deployed simulation continues running.

## Planned daily loop

Players propose laws and vote on a React town map using Discord sign-in. SQLite will enforce one ballot per account per day, allow vote changes until midnight UTC, and send tied proposals to a runoff. The local ballot prototype uses pre-counted sample votes and does not provide accounts or a voting interface.

A scheduled closer will capture the winning law, Git commit, previous snapshot and seed. A worker will start Devin on a branch from that commit with the winning law, affected behavior and replay fixture. Devin's assignment is to write a failing test, implement the law, run the tests, replay yesterday and open a pull request. An unexpected event, such as a fine against a baker across town, will be sent back once. A repeated failure pauses the job for review. A human reviews the pull request before the law goes live. See `docs/devin-task.md` for the hard-hat example. Live Devin sessions, replay comparison, retries, pull requests and deployment are planned.

The code-freeze headline is planned as “Council bans software updates. First bug promoted to local tradition.”
