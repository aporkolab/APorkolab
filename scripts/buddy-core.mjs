export const PROFILE_REPO = 'aporkolab/APorkolab';
export const BUILD_REPO = 'aporkolab/aporkolab.github.io';
export const COOLDOWN_MS = 15 * 60 * 1000;
export const BUILD_RUNS_URL = `https://api.github.com/repos/${BUILD_REPO}/actions/workflows/pages.yml/runs?per_page=1&branch=main`;
export const isProfileRepo = value => typeof value === 'string' && value.toLowerCase() === PROFILE_REPO.toLowerCase();
export const COMMANDS = Object.freeze({ '[buddy] coffee': 'coffee', '[buddy] debug': 'debug', '[buddy] nap': 'nap' });
const ACTIONS = new Set(Object.values(COMMANDS));
const LOGIN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export function initialState() {
  return {
    version: 1, name: 'Bot Buddy', mood: 'idle', action: null, energy: 80,
    lastActionAt: null, lastActivity: null, totalInteractions: 0, lastUpdatedAt: null,
    build: { status: 'unknown', updatedAt: null, repo: BUILD_REPO },
    processedIssues: {}, actorCooldowns: {},
  };
}

export function parseCommand(title) {
  return typeof title === 'string' && Object.hasOwn(COMMANDS, title) ? COMMANDS[title] : null;
}

export function parseIssueEvent(event) {
  if (!event || event.action !== 'opened' || !isProfileRepo(event.repository?.full_name)) return null;
  const issue = event.issue;
  const action = parseCommand(issue?.title);
  if (!action || issue.pull_request || issue.state !== 'open' || issue.user?.type !== 'User') return null;
  if (!Number.isSafeInteger(issue.number) || issue.number < 1 || !LOGIN.test(issue.user?.login ?? '')) return null;
  return { number: issue.number, action, actor: issue.user.login.toLowerCase() };
}

export function validateState(state) {
  if (!state || state.version !== 1 || !Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100) throw new Error('Invalid buddy state.');
  if (!Number.isSafeInteger(state.totalInteractions) || state.totalInteractions < 0) throw new Error('Invalid interaction count.');
  for (const key of ['processedIssues', 'actorCooldowns']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new Error(`Invalid ${key}.`);
  }
  return state;
}

function iso(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('A valid timestamp is required.');
  return date.toISOString();
}

/** Mutates serializable state. Duplicate and throttled commands never increment interactions. */
export function applyCommand(state, command, now) {
  validateState(state);
  if (!command || !ACTIONS.has(command.action) || !LOGIN.test(command.actor ?? '') || !Number.isSafeInteger(command.number) || command.number < 1) throw new TypeError('Invalid buddy command.');
  const at = iso(now);
  const key = String(command.number);
  if (Object.hasOwn(state.processedIssues, key)) return { processed: true, applied: false, duplicate: true, outcome: state.processedIssues[key].outcome, closeIssue: command.number };
  const actor = command.actor.toLowerCase();
  const previous = Object.hasOwn(state.actorCooldowns, actor) ? Date.parse(state.actorCooldowns[actor]) : NaN;
  const coolingDown = Number.isFinite(previous) && Date.parse(at) - previous < COOLDOWN_MS;
  const outcome = coolingDown ? 'cooldown' : 'applied';
  state.processedIssues[key] = { action: command.action, actor, at, outcome };
  if (coolingDown) return { processed: true, applied: false, duplicate: false, outcome, closeIssue: command.number };
  const effects = { coffee: { energy: 20, mood: 'happy' }, debug: { energy: -12, mood: 'focused' }, nap: { energy: 30, mood: 'sleepy' } };
  const effect = effects[command.action];
  state.energy = Math.max(0, Math.min(100, state.energy + effect.energy));
  state.action = command.action;
  state.mood = effect.mood;
  state.lastActionAt = at;
  state.lastActivity = { action: command.action, actor, at, issueNumber: command.number };
  state.totalInteractions += 1;
  state.actorCooldowns[actor] = at;
  return { processed: true, applied: true, duplicate: false, outcome, closeIssue: command.number };
}

export function refreshState(state, build, now) {
  validateState(state);
  const at = iso(now);
  const previous = Date.parse(state.lastUpdatedAt);
  if (Number.isFinite(previous)) {
    const hours = Math.max(0, (Date.parse(at) - previous) / 3600000);
    state.energy = Math.round(Math.max(0, state.energy - hours * 1.5) * 100) / 100;
  }
  state.build = {
    status: ['success', 'failure', 'running', 'unknown'].includes(build?.status) ? build.status : 'unknown',
    updatedAt: Number.isFinite(Date.parse(build?.updatedAt)) ? new Date(build.updatedAt).toISOString() : null,
    repo: BUILD_REPO,
    checkedAt: at,
  };
  const recentAction = Number.isFinite(Date.parse(state.lastActionAt)) && Date.parse(at) - Date.parse(state.lastActionAt) < 8 * 3600000;
  if (!recentAction) {
    state.action = null;
    state.mood = state.build.status === 'failure' ? 'worried' : state.energy < 25 ? 'sleepy' : state.build.status === 'running' ? 'focused' : state.build.status === 'success' ? 'happy' : 'idle';
  }
  state.lastUpdatedAt = at;
  return state;
}

export function buildStatus(payload) {
  const run = payload?.workflow_runs?.[0];
  if (!run) return { status: 'unknown', updatedAt: null };
  let status = 'unknown';
  if (['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(run.status)) status = 'running';
  else if (run.status === 'completed' && run.conclusion === 'success') status = 'success';
  else if (run.status === 'completed' && ['failure', 'timed_out', 'action_required', 'stale', 'startup_failure'].includes(run.conclusion)) status = 'failure';
  return { status, updatedAt: Number.isFinite(Date.parse(run.updated_at)) ? new Date(run.updated_at).toISOString() : null };
}

export function canCloseIssue(issue, record) {
  return Boolean(record && ACTIONS.has(record.action) && ['applied', 'cooldown'].includes(record.outcome) && issue?.state === 'open' && !issue.pull_request && parseCommand(issue.title) === record.action && issue.user?.login?.toLowerCase() === record.actor);
}
