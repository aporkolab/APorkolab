import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, parseCommand, parseIssueEvent, applyCommand, refreshState, buildStatus, canCloseIssue, COOLDOWN_MS, PROFILE_REPO, isProfileRepo, BUILD_RUNS_URL } from '../scripts/buddy-core.mjs';
import { renderBuddy } from '../scripts/render-buddy.mjs';

const NOW = '2026-10-09T08:00:00.000Z';
function issueEvent(title = '[buddy] coffee') {
  return { action: 'opened', repository: { full_name: PROFILE_REPO }, issue: { number: 1, state: 'open', title, user: { login: 'Test-Visitor', type: 'User' } } };
}
const command = (number = 1, action = 'coffee', actor = 'test-visitor') => ({ number, action, actor });

test('only exact titles become actions; shell payloads and near matches are inert', () => {
  for (const action of ['coffee', 'debug', 'nap']) assert.equal(parseCommand(`[buddy] ${action}`), action);
  for (const title of [null, 1, '[Buddy] coffee', '[buddy] coffee ', ' [buddy] coffee', '[buddy] coffee\n', '[buddy] coffee $(id)', '[buddy] coffee; exit 0', '[buddy] coffee`id`', '__proto__', 'constructor', '[buddy] https://example.com']) assert.equal(parseCommand(title), null);
});

test('issue event validation rejects other repos, edited events, bots, PRs and invalid identities', () => {
  assert.deepEqual(parseIssueEvent(issueEvent()), command());
  for (const name of ['aporkolab/APorkolab', 'aporkolab/aporkolab', 'APORKOLAB/APORKOLAB']) {
    const event = issueEvent(); event.repository.full_name = name;
    assert.equal(isProfileRepo(name), true); assert.deepEqual(parseIssueEvent(event), command());
  }
  assert.equal(isProfileRepo('aporkolab/APorkolab-extra'), false);
  assert.equal(BUILD_RUNS_URL, 'https://api.github.com/repos/aporkolab/aporkolab.github.io/actions/workflows/pages.yml/runs?per_page=1&branch=main');
  for (const modify of [
    event => { event.repository.full_name = 'other/repository'; },
    event => { event.action = 'edited'; },
    event => { event.issue.state = 'closed'; },
    event => { event.issue.pull_request = {}; },
    event => { event.issue.number = 1.5; },
    event => { event.issue.number = 0; },
    event => { event.issue.number = Number.MAX_SAFE_INTEGER + 1; },
    event => { event.issue.user.type = 'Bot'; },
    event => { event.issue.user.login = '$(curl attacker)'; },
    event => { event.issue.user.login = 'name\nOTHER_OUTPUT=1'; },
    event => { event.issue.title = '[buddy] coffee && printenv'; },
  ]) {
    const event = issueEvent(); modify(event); assert.equal(parseIssueEvent(event), null);
  }
});

test('duplicate delivery is idempotent across serialized persisted state', () => {
  const state = initialState();
  const first = applyCommand(state, command(), NOW);
  assert.equal(first.applied, true);
  const saved = JSON.parse(JSON.stringify(state));
  const before = structuredClone(saved);
  const repeat = applyCommand(saved, command(), '2026-10-10T08:00:00Z');
  assert.equal(repeat.duplicate, true);
  assert.equal(repeat.closeIssue, 1);
  assert.deepEqual(saved, before);
  assert.equal(saved.totalInteractions, 1);
  assert.equal(saved.energy, 100);
});

test('cooldown is per actor, receipts persist, and the exact boundary permits an action', () => {
  const state = initialState();
  applyCommand(state, command(), NOW);
  const ignored = applyCommand(state, command(2, 'debug'), Date.parse(NOW) + COOLDOWN_MS - 1);
  assert.equal(ignored.outcome, 'cooldown');
  assert.equal(state.totalInteractions, 1);
  assert.equal(state.processedIssues['2'].outcome, 'cooldown');
  assert.equal(applyCommand(state, command(3, 'debug', 'another-visitor'), NOW).applied, true);
  assert.equal(applyCommand(state, command(4, 'nap'), Date.parse(NOW) + COOLDOWN_MS).applied, true);
  assert.equal(state.totalInteractions, 3);
  const count = state.totalInteractions;
  assert.equal(applyCommand(state, command(2, 'debug'), Date.parse(NOW) + 2 * COOLDOWN_MS).duplicate, true);
  assert.equal(state.totalInteractions, count);
});

test('all actions update scene metadata and clamp energy within the allowed range', () => {
  for (const [action, mood, energy] of [['coffee', 'happy', 100], ['debug', 'focused', 68], ['nap', 'sleepy', 100]]) {
    const state = initialState(); applyCommand(state, command(1, action), NOW);
    assert.equal(state.action, action); assert.equal(state.mood, mood); assert.equal(state.energy, energy);
    assert.deepEqual(state.lastActivity, { action, actor: 'test-visitor', at: NOW, issueNumber: 1 });
  }
  const exhausted = initialState(); exhausted.energy = 2; applyCommand(exhausted, command(1, 'debug'), NOW);
  assert.equal(exhausted.energy, 0);
  assert.throws(() => applyCommand(initialState(), command(1, 'rm -rf /'), NOW), TypeError);
  assert.throws(() => applyCommand(initialState(), command(), 'not-a-date'), TypeError);
});

test('public build payloads only map to known statuses and never introduce external URLs', () => {
  for (const [run, expected] of [
    [{ status: 'in_progress' }, 'running'],
    [{ status: 'completed', conclusion: 'success' }, 'success'],
    [{ status: 'completed', conclusion: 'failure' }, 'failure'],
    [{ status: 'completed', conclusion: 'cancelled' }, 'unknown'],
    [{ status: '<script>evil()</script>' }, 'unknown'],
  ]) assert.equal(buildStatus({ workflow_runs: [run] }).status, expected);
  assert.deepEqual(buildStatus({}), { status: 'unknown', updatedAt: null });
  const state = initialState();
  refreshState(state, { status: 'failure', repo: 'attacker/url', updatedAt: NOW }, NOW);
  assert.equal(state.mood, 'worried');
  assert.equal(state.build.repo, 'aporkolab/aporkolab.github.io');
  assert.equal(state.build.updatedAt, NOW);
  applyCommand(state, command(1, 'coffee'), NOW);
  refreshState(state, { status: 'failure' }, Date.parse(NOW) + 3600000);
  assert.equal(state.mood, 'happy');
  refreshState(state, { status: 'failure' }, Date.parse(NOW) + 9 * 3600000);
  assert.equal(state.action, null); assert.equal(state.mood, 'worried');
});

test('issue closure requires an exact matching persisted receipt and current title/author', () => {
  const state = initialState(); applyCommand(state, command(), NOW);
  const issue = issueEvent().issue;
  assert.equal(canCloseIssue(issue, state.processedIssues['1']), true);
  assert.equal(canCloseIssue(issue, null), false);
  assert.equal(canCloseIssue({ ...issue, title: 'An unrelated real issue' }, state.processedIssues['1']), false);
  assert.equal(canCloseIssue({ ...issue, user: { login: 'someone-else' } }, state.processedIssues['1']), false);
  assert.equal(canCloseIssue({ ...issue, state: 'closed' }, state.processedIssues['1']), false);
  assert.equal(canCloseIssue({ ...issue, pull_request: {} }, state.processedIssues['1']), false);
});

test('renderer produces standalone deterministic SVG and escapes external display text', () => {
  const state = initialState();
  const svg = renderBuddy(state);
  assert.match(svg, /<svg\b/); assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.equal(svg, renderBuddy(state));
  const hostile = renderBuddy({ ...state, name: '<script>alert(1)</script>', lastActivity: { actor: 'visitor<script>', action: 'coffee', at: NOW, issueNumber: 1 } });
  assert.doesNotMatch(hostile, /<script\b|<foreignObject\b|https?:\/\/(?!www\.w3\.org)/i);
});

test('workflow serializes updates, separates write scopes, and never interpolates issue text into shell', async () => {
  const workflow = await readFile(new URL('../.github/workflows/buddy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /\$\{\{\s*github\.event\.issue\.(?:title|body|user)/);
  assert.doesNotMatch(workflow, /git push[^\n]*(?:--force|\s-f(?:\s|$))/);
  const publisher = await readFile(new URL('../scripts/buddy-publish.sh', import.meta.url), 'utf8');
  assert.match(publisher, /git add -- state\/buddy\.json bot-buddy\.svg/);
  assert.match(publisher, /git reset --hard refs\/remotes\/origin\/main/);
  assert.doesNotMatch(publisher, /git push[^\n]*(?:--force|\s-f(?:\s|$))/);
});
