import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
test('publish conflict rereads latest state, preserves other commits and applies one receipt once', () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-race-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  const rival = join(root, 'rival');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    mkdirSync(work);
    git(root, 'init', '--bare', remote);
    git(work, 'init', '-b', 'main');
    git(work, 'config', 'user.name', 'Test'); git(work, 'config', 'user.email', 'test@example.com');
    for (const dir of ['scripts', 'state', 'tests']) mkdirSync(join(work, dir));
    copyFileSync(new URL('../scripts/buddy-publish.sh', import.meta.url), join(work, 'scripts/buddy-publish.sh'));
    writeFileSync(join(work, 'tests/buddy.test.mjs'), "import test from 'node:test'; test('fixture',()=>{});\n");
    writeFileSync(join(work, 'scripts/buddy.mjs'), "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync('state/buddy.json')); if(!s.receipt){s.receipt=true;s.count++;} fs.writeFileSync('state/buddy.json',JSON.stringify(s));fs.writeFileSync('bot-buddy.svg',String(s.count));\n");
    writeFileSync(join(work, 'state/buddy.json'), JSON.stringify({ count: 0, receipt: false }));
    writeFileSync(join(work, 'bot-buddy.svg'), '0');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'Initial');
    git(work, 'remote', 'add', 'origin', remote); git(work, 'push', '-u', 'origin', 'main');
    git(root, 'clone', '--branch', 'main', remote, rival);
    git(rival, 'config', 'user.name', 'Another writer'); git(rival, 'config', 'user.email', 'writer@example.com');
    // The rival applies the same command and makes an unrelated change during the first push.
    writeFileSync(join(rival, 'state/buddy.json'), JSON.stringify({ count: 1, receipt: true }));
    writeFileSync(join(rival, 'unrelated.txt'), 'Keep this change.');
    git(rival, 'add', '.'); git(rival, 'commit', '-m', 'Concurrent update');
    const marker = join(root, 'raced');
    const hook = join(work, '.git/hooks/pre-push');
    writeFileSync(hook, `#!/bin/sh\nif [ ! -e ${quote(marker)} ]; then\n touch ${quote(marker)}\n git -C ${quote(rival)} push origin main >/dev/null 2>&1\nfi\n`);
    chmodSync(hook, 0o755);
    const result = spawnSync('bash', ['scripts/buddy-publish.sh'], { cwd: work, env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_OUTPUT: join(root, 'outputs') }, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Main moved during attempt 1/);
    assert.deepEqual(JSON.parse(readFileSync(join(work, 'state/buddy.json'), 'utf8')), { count: 1, receipt: true });
    assert.equal(readFileSync(join(work, 'unrelated.txt'), 'utf8'), 'Keep this change.');
    assert.equal(git(work, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'refs/heads/main'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
