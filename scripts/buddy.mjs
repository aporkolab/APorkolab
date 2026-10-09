import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE_REPO, BUILD_RUNS_URL, isProfileRepo, initialState, parseIssueEvent, validateState, applyCommand, refreshState, buildStatus, canCloseIssue } from './buddy-core.mjs';
import { renderBuddy } from './render-buddy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = resolve(ROOT, 'state/buddy.json');
const SVG_PATH = resolve(ROOT, 'bot-buddy.svg');
const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aporkolab-bot-buddy' };

async function loadState() {
  try { return validateState(JSON.parse(await readFile(STATE_PATH, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return initialState(); throw error; }
}
async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, path);
}
async function output(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
async function readBuild() {
  try {
    // Fixed public endpoint. No token, event URLs, redirects, or user-controlled URL parts.
    const response = await fetch(BUILD_RUNS_URL, { headers: HEADERS, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return buildStatus(await response.json());
  } catch (error) {
    console.warn(`Build status unavailable (${error.name}). Rendering unknown status.`);
    return { status: 'unknown', updatedAt: null };
  }
}
async function githubIssue(number, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required to close a processed issue.');
  const response = await fetch(`https://api.github.com/repos/${PROFILE_REPO}/issues/${number}`, {
    method, headers: { ...HEADERS, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`GitHub issue request failed: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const mode = process.argv[2] ?? 'update';
  if (!['update', 'render', 'close'].includes(mode)) throw new Error('Usage: node scripts/buddy.mjs [update|render|close]');
  const state = await loadState();
  if (mode === 'render') {
    await atomicWrite(SVG_PATH, renderBuddy(state));
    console.log('Rendered bot-buddy.svg.');
    return;
  }
  if (!isProfileRepo(process.env.GITHUB_REPOSITORY)) throw new Error('Buddy automation only runs in aporkolab/APorkolab.');
  if (mode === 'close') {
    const raw = process.env.BUDDY_ISSUE_NUMBER ?? '';
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error('Invalid issue number.');
    const record = Object.hasOwn(state.processedIssues, raw) ? state.processedIssues[raw] : null;
    if (!record) throw new Error('Issue has not been recorded as processed.');
    const issue = await githubIssue(Number(raw));
    if (!canCloseIssue(issue, record)) { console.log('Issue already closed or no longer matches its processed command.'); return; }
    await githubIssue(Number(raw), { method: 'PATCH', body: { state: 'closed', state_reason: record.outcome === 'applied' ? 'completed' : 'not_planned' } });
    console.log(`Closed processed Buddy issue #${raw}. No comment posted.`);
    return;
  }
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!['issues', 'schedule', 'workflow_dispatch', 'push'].includes(eventName)) throw new Error('Unsupported workflow event.');
  let command = null;
  if (eventName === 'issues') {
    if (!process.env.GITHUB_EVENT_PATH) throw new Error('Missing event payload.');
    command = parseIssueEvent(JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')));
    if (!command) { console.log('Ignored non-Buddy issue.'); return; }
  }
  const now = new Date().toISOString();
  refreshState(state, await readBuild(), now);
  if (command) {
    const outcome = applyCommand(state, command, now);
    await output('close_issue', outcome.closeIssue);
    console.log(`Buddy command ${command.action}: ${outcome.duplicate ? 'already processed' : outcome.outcome}.`);
  }
  // Render first, so a renderer failure cannot leave the state claiming success.
  const svg = renderBuddy(state);
  await atomicWrite(SVG_PATH, svg);
  await atomicWrite(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  console.log('Updated Buddy state and SVG.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
