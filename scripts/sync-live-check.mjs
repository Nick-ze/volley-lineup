#!/usr/bin/env node
/**
 * Live check of the sync backend (v10): runs the main sync flows against the real Supabase
 * project with two test users and prints PASS / FAIL per step. Not part of CI.
 *
 * Needs:
 *   - `@supabase/supabase-js` (an app dependency since v10.0; run `npm ci` first);
 *   - `supabase/public-config.json` with `{ "url": "...", "publishableKey": "..." }`;
 *   - the migrations in `supabase/migrations` applied to that project;
 *   - two password test users. Create them by running `supabase/tests/test-users.sql` as
 *     postgres (SQL editor or psql); its last result shows the password. Delete them afterwards
 *     with `supabase/tests/test-users-cleanup.sql`.
 *
 * Usage:
 *   VL_TEST_PASSWORD=<password> node scripts/sync-live-check.mjs
 *
 * Environment:
 *   VL_TEST_PASSWORD    password of both users (required)
 *   VL_TEST_PASSWORD_B  password of user B, if it differs
 *   VL_TEST_EMAIL_A     user A, the manager   (default vl-test-1@example.test)
 *   VL_TEST_EMAIL_B     user B, the other one (default vl-test-2@example.test)
 *
 * Steps: anon access, create team, push, pull, stranger sees nothing, invite + join as player,
 * player push denied, older write ignored (last write wins), hold / take over, removed member
 * loses access, delete team. The script deletes its team at the end, even after a failure.
 * Exits with 1 when a step fails.
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const CONFIG_PATH = new URL('../supabase/public-config.json', import.meta.url);

let failures = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    return true;
  } catch (e) {
    failures += 1;
    console.log(`FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.code ?? '?'} ${error.message}`);
  return data;
}

/** Calls an RPC that must fail and returns the SQLSTATE / error code. */
async function rpcError(client, fn, args) {
  const { error } = await client.rpc(fn, args);
  if (!error) throw new Error(`${fn} succeeded, but it should have been refused`);
  return error.code;
}

async function rows(query) {
  const { data, error } = await query;
  if (error) throw new Error(`select failed: ${error.code ?? '?'} ${error.message}`);
  return data;
}

async function loadConfig() {
  const text = await readFile(CONFIG_PATH, 'utf8').catch(() => {
    throw new Error('supabase/public-config.json is missing (it comes with the v10 foundation)');
  });
  const config = JSON.parse(text);
  if (typeof config.url !== 'string' || typeof config.publishableKey !== 'string') {
    throw new Error('supabase/public-config.json needs "url" and "publishableKey"');
  }
  return config;
}

async function main() {
  const password = process.env.VL_TEST_PASSWORD;
  if (!password) {
    console.error('Set VL_TEST_PASSWORD (see the header of this script).');
    process.exit(2);
  }
  const users = {
    a: { email: process.env.VL_TEST_EMAIL_A ?? 'vl-test-1@example.test', password },
    b: {
      email: process.env.VL_TEST_EMAIL_B ?? 'vl-test-2@example.test',
      password: process.env.VL_TEST_PASSWORD_B ?? password,
    },
  };

  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch {
    console.error('@supabase/supabase-js is missing: run `npm ci` first.');
    process.exit(2);
  }
  const { url, publishableKey } = await loadConfig();
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const anon = createClient(url, publishableKey, options);
  const a = createClient(url, publishableKey, options);
  const b = createClient(url, publishableKey, options);

  for (const [client, user, label] of [
    [a, users.a, 'A'],
    [b, users.b, 'B'],
  ]) {
    const ok = await step(`sign in ${label} (${user.email})`, async () => {
      const { error } = await client.auth.signInWithPassword(user);
      if (error) throw new Error(error.message);
    });
    if (!ok) {
      console.log('Cannot continue without both test users.');
      process.exit(1);
    }
  }
  const { data: userB } = await b.auth.getUser();
  const userBId = userB.user?.id;

  const teamId = `live-check-${randomUUID()}`;
  const at = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
  let teamCreated = false;

  try {
    await step('anon reads keepalive, but no team data and no RPCs', async () => {
      const keepalive = await rows(anon.from('keepalive').select('id').limit(1));
      expect(keepalive.length === 1, 'keepalive row missing');
      const { error } = await anon.from('teams').select('id').limit(1);
      expect(error?.code === '42501', `teams select should be 42501, got ${error?.code}`);
      const code = await rpcError(anon, 'pull_changes', { p_team_id: teamId, p_after: 0 });
      expect(code === '42501', `pull_changes should be 42501, got ${code}`);
    });

    await step('A creates the team', async () => {
      const result = await rpc(a, 'create_team', {
        p_team_id: teamId,
        p_display_name: 'Live check A',
      });
      expect(result === 'created', `expected 'created', got ${JSON.stringify(result)}`);
      teamCreated = true;
    });

    await step('A pushes records', async () => {
      const results = await rpc(a, 'push_records', {
        p_team_id: teamId,
        p_device_id: 'live-check-a',
        p_records: [
          { kind: 'team', id: teamId, at: at(-1000), payload: { name: 'Live check' } },
          { kind: 'player', id: 'p1', at: at(-1000), payload: { name: 'Pia', number: 7 } },
          { kind: 'set', id: 'm1/1', at: at(-1000), payload: { setNumber: 1 } },
        ],
      });
      expect(results.length === 3, `expected 3 results, got ${results.length}`);
      expect(
        results.every((r) => r.applied),
        'not every record was applied',
      );
    });

    await step('A pulls its records', async () => {
      const pulled = await rpc(a, 'pull_changes', { p_team_id: teamId, p_after: 0 });
      expect(pulled.rows.length === 3, `expected 3 rows, got ${pulled.rows.length}`);
    });

    await step('B (stranger) sees nothing and cannot take the id', async () => {
      const pulled = await rpc(b, 'pull_changes', { p_team_id: teamId, p_after: 0 });
      expect(pulled.rows.length === 0, `stranger pulled ${pulled.rows.length} rows`);
      const teams = await rows(b.from('teams').select('id').eq('id', teamId));
      expect(teams.length === 0, 'stranger reads the team');
      const result = await rpc(b, 'create_team', { p_team_id: teamId, p_display_name: 'B' });
      expect(result === 'taken', `expected 'taken', got ${JSON.stringify(result)}`);
    });

    await step('A invites, B joins as player', async () => {
      const invite = await rpc(a, 'create_invite', { p_team_id: teamId, p_role: 'player' });
      const joined = await rpc(b, 'join_team', {
        p_code: `${invite.code.slice(0, 5)}-${invite.code.slice(5)}`.toLowerCase(),
        p_display_name: 'Live check B',
      });
      expect(
        joined.team_id === teamId && joined.role === 'player',
        `unexpected join result ${JSON.stringify(joined)}`,
      );
      const pulled = await rpc(b, 'pull_changes', { p_team_id: teamId, p_after: 0 });
      expect(pulled.rows.length === 3, `player pulled ${pulled.rows.length} rows`);
      const invites = await rows(b.from('invites').select('id').eq('team_id', teamId));
      expect(invites.length === 0, 'a player reads invites');
    });

    await step('B (player) cannot push', async () => {
      const code = await rpcError(b, 'push_records', {
        p_team_id: teamId,
        p_device_id: 'live-check-b',
        p_records: [{ kind: 'player', id: 'p1', at: at(), payload: { name: 'Hacked' } }],
      });
      expect(code === '42501', `expected 42501, got ${code}`);
    });

    await step('an older write is ignored (last write wins)', async () => {
      const [result] = await rpc(a, 'push_records', {
        p_team_id: teamId,
        p_device_id: 'live-check-a',
        p_records: [{ kind: 'player', id: 'p1', at: at(-3_600_000), payload: { name: 'Old' } }],
      });
      expect(result.applied === false, 'older write was applied');
      expect(result.payload?.name === 'Pia', 'server payload not returned');
    });

    await step('hold and take over a live match', async () => {
      const held = await rpc(a, 'hold_match', {
        p_team_id: teamId,
        p_match_id: 'm1',
        p_device_id: 'live-check-a',
        p_holder_name: 'Live check A',
      });
      expect(held.granted === true, 'A did not get the hold');
      await rpc(a, 'set_member_role', { p_team_id: teamId, p_user_id: userBId, p_role: 'manager' });
      const refused = await rpc(b, 'hold_match', {
        p_team_id: teamId,
        p_match_id: 'm1',
        p_device_id: 'live-check-b',
        p_holder_name: 'Live check B',
      });
      expect(
        refused.granted === false && refused.holder_name === 'Live check A',
        `expected a refusal naming A, got ${JSON.stringify(refused)}`,
      );
      const taken = await rpc(b, 'hold_match', {
        p_team_id: teamId,
        p_match_id: 'm1',
        p_device_id: 'live-check-b',
        p_holder_name: 'Live check B',
        p_take_over: true,
      });
      expect(taken.granted === true, 'take-over was refused');
      await rpc(b, 'release_match', {
        p_team_id: teamId,
        p_match_id: 'm1',
        p_device_id: 'live-check-b',
      });
      const holds = await rows(a.from('match_holds').select('match_id').eq('team_id', teamId));
      expect(holds.length === 0, 'the hold was not released');
    });

    await step('a removed member loses access', async () => {
      await rpc(a, 'remove_member', { p_team_id: teamId, p_user_id: userBId });
      const pulled = await rpc(b, 'pull_changes', { p_team_id: teamId, p_after: 0 });
      expect(pulled.rows.length === 0, `removed member pulled ${pulled.rows.length} rows`);
      const teams = await rows(b.from('teams').select('id').eq('id', teamId));
      expect(teams.length === 0, 'removed member still reads the team');
    });

    await step('A deletes the team', async () => {
      await rpc(a, 'delete_team', { p_team_id: teamId });
      teamCreated = false;
      const teams = await rows(a.from('teams').select('id').eq('id', teamId));
      expect(teams.length === 0, 'the team still exists');
    });
  } finally {
    if (teamCreated) {
      const { error } = await a.rpc('delete_team', { p_team_id: teamId });
      console.log(
        error ? `Cleanup failed, delete team ${teamId} by hand.` : `Cleaned up ${teamId}.`,
      );
    }
    await a.auth.signOut({ scope: 'local' });
    await b.auth.signOut({ scope: 'local' });
  }

  console.log(failures === 0 ? '\nALL LIVE CHECKS PASSED' : `\n${failures} step(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
