import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./scaffold.mjs', import.meta.url));

function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'scaffold-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function cli(args, options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

function success(args, options) {
  const result = cli(args, options);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function read(dir, file) {
  return readFileSync(join(dir, file), 'utf8');
}

const stacks = [
  { template: 'server', role: 'Server application' },
  { template: 'web', role: 'Web application' },
  { template: 'client', role: 'Client application' },
];

for (const { template, role } of stacks) {
  test(`creates a standalone ${template} project in place`, (t) => {
    const dir = join(sandbox(t), 'my project');
    const args = ['--template', template, '--dir', dir, '--name', 'my-app', '--no-git'];
    const preview = success([...args, '--dry-run']);
    assert.match(preview, /\[dry-run\]/);
    assert.ok(preview.includes(dir));
    assert.ok(preview.includes('my-app'));
    assert.ok(preview.includes(template));
    assert.equal(existsSync(dir), false);

    const summary = success(args);
    assert.ok(summary.includes(`created: ${dir}`));
    assert.doesNotMatch(summary, /backed up:/);
    const agents = read(dir, 'AGENTS.md');
    assert.equal(agents.split('\n')[0], '# my-app');
    assert.ok(agents.includes(role));
    assert.ok(agents.includes('single-repository'));
    assert.doesNotMatch(agents, /<!-- STACK_GUIDE -->|\{\{PROJECT\}\}/);
    assert.equal(read(dir, 'CLAUDE.md').trim(), '@AGENTS.md');
    assert.match(read(dir, 'Makefile'), /^APP_NAME\s+:= my-app$/m);
    for (const [doc, title] of [['CONTEXT.md', 'Context'], ['ROADMAP.md', 'Roadmap'], ['WORKFLOW.md', 'Development Workflow']]) {
      assert.equal(read(dir, doc).split('\n')[0], `# ${title} — my-app`);
      assert.ok(agents.includes(`[${doc}](./${doc})`));
    }
    assert.deepEqual(readdirSync(join(dir, 'docs')).sort(), ['plans', 'specs']);
    assert.equal(existsSync(join(dir, '.git')), false);
    assert.equal(existsSync(join(dir, 'AGENTS.md.bak')), false);
    assert.equal(existsSync(join(dir, 'CLAUDE.md.bak')), false);
    assert.equal(existsSync(join(dir, 'fly.toml.example')), template === 'server');
    assert.equal(existsSync(join(dir, 'wrangler.jsonc.example')), template === 'web');
    assert.equal(existsSync(join(dir, '.env.example')), template !== 'client');
    if (template === 'server') assert.match(read(dir, 'fly.toml.example'), /^app\s+= "my-app"$/m);
    if (template === 'web') assert.match(read(dir, 'wrangler.jsonc.example'), /"name": "my-app-staging"/);
  });
}

test('keeps a project name ending in the stack name', (t) => {
  const dir = join(sandbox(t), 'demo-server');
  mkdirSync(dir);
  success(['--template', 'server', '--no-git'], { cwd: dir });
  assert.equal(read(dir, 'AGENTS.md').split('\n')[0], '# demo-server');
  assert.match(read(dir, 'Makefile'), /^APP_NAME\s+:= demo-server$/m);
  assert.match(read(dir, 'fly.toml.example'), /^app\s+= "demo-server"$/m);
});

test('initializes an empty repository on main and reuses an existing branch', (t) => {
  const dir = join(sandbox(t), 'demo');
  const args = ['--template', 'web', '--dir', dir];
  success(args);
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  assert.equal(git('symbolic-ref', '--short', 'HEAD'), 'main');
  assert.throws(() => git('rev-parse', '--verify', 'HEAD'));
  assert.equal(git('ls-files'), '');
  git('branch', '-m', 'trunk');
  success([...args, '--on-conflict', 'overwrite']);
  assert.equal(git('symbolic-ref', '--short', 'HEAD'), 'trunk');
});

for (const policy of ['backup', 'overwrite']) {
  test(`previews and resolves shared and stack file conflicts with ${policy}`, (t) => {
    const dir = join(sandbox(t), 'demo');
    mkdirSync(join(dir, '.claude'), { recursive: true });
    const names = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'ROADMAP.md', 'WORKFLOW.md', '.claude/settings.json'];
    for (const name of names) writeFileSync(join(dir, name), `original ${name}`);
    writeFileSync(join(dir, 'AGENTS.md.bak'), 'older backup');
    writeFileSync(join(dir, '.claude/local.txt'), 'unrelated');
    const args = ['--template', 'client', '--dir', dir, '--no-git'];
    if (policy === 'overwrite') args.push('--on-conflict', policy);
    const preview = success([...args, '--dry-run']);
    const conflicts = preview.split('\n').find((line) => line.includes('conflicts ('));
    assert.ok(conflicts?.includes(policy === 'overwrite' ? 'will overwrite' : 'will back up'));
    for (const name of names) {
      assert.ok(conflicts.includes(join(dir, name)));
      assert.equal(read(dir, name), `original ${name}`);
    }
    assert.equal(existsSync(join(dir, 'Makefile')), false);
    const summary = success(args);
    const backupPaths = summary.split('\n').filter((line) => line.startsWith('backed up: '));
    assert.equal(backupPaths.length, policy === 'backup' ? names.length : 0);
    for (const name of names) {
      assert.notEqual(read(dir, name), `original ${name}`);
      const backup = name === 'AGENTS.md' ? 'AGENTS.md.bak.1' : `${name}.bak`;
      assert.equal(existsSync(join(dir, backup)), policy === 'backup');
      if (policy === 'backup') {
        assert.ok(backupPaths.includes(`backed up: ${join(dir, backup)}`));
        assert.equal(read(dir, backup), `original ${name}`);
      }
    }
    assert.equal(read(dir, 'AGENTS.md.bak'), 'older backup');
    assert.equal(read(dir, '.claude/local.txt'), 'unrelated');
  });
}

test('reports recoverable files and backups when copying into an existing tree fails', (t) => {
  const dir = sandbox(t);
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude/settings.json'), 'MY SETTINGS');
  writeFileSync(join(dir, 'docs'), 'BLOCKER');
  const result = cli(['--name', 'demo', '--template', 'server', '--dir', dir, '--no-git']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /partial:/);
  assert.match(result.stderr, /backed up \(originals preserved/);
  const entries = result.stderr.split('\n').filter((line) => line.startsWith('  ')).map((line) => line.trim());
  assert.ok(entries.includes(join(dir, '.claude/settings.json')));
  assert.ok(entries.includes(join(dir, '.claude/settings.json.bak')));
  assert.ok(!entries.includes(dir));
  assert.ok(!entries.includes(join(dir, 'docs')));
  assert.equal(read(dir, '.claude/settings.json.bak'), 'MY SETTINGS');
  assert.equal(read(dir, 'docs'), 'BLOCKER');
});

test('reports a newly created directory when git init fails', (t) => {
  const dir = join(sandbox(t), 'demo');
  const result = cli(['--template', 'web', '--dir', dir], {
    env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'invalid', GIT_CONFIG_VALUE_0: 'x' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /partial:/);
  assert.ok(result.stderr.split('\n').includes(`  ${dir}`));
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
});

test('rejects invalid inputs before creating a repository', (t) => {
  const dir = join(sandbox(t), 'demo');
  for (const [args, error] of [
    [[], /--template/],
    [['--template', 'unknown'], /--template/],
    [['--template', 'client', '--on-conflict', 'unknown'], /--on-conflict/],
    ...['My-App', '1app', 'a', 'app_x', 'a'.repeat(51)].map((name) => [
      ['--template', 'client', '--name', name], /project name/i,
    ]),
  ]) {
    const result = cli(['--dir', dir, ...args]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.equal(existsSync(dir), false);
  }
  for (const flag of ['--name', '--dir', '--on-conflict', '--template']) {
    for (const tail of [[], ['--dry-run']]) {
      const result = cli(['--dir', dir, '--template', 'server', flag, ...tail]);
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes(flag), result.stderr);
      assert.equal(existsSync(dir), false);
    }
  }
});

test('CLI rejects positional arguments and unknown options before writing files', (t) => {
  const dir = join(sandbox(t), 'demo');
  for (const unexpected of ['single', '--unknown-option']) {
    const result = cli([unexpected, '--template', 'server', '--dir', dir, '--no-git']);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(unexpected));
    assert.equal(existsSync(dir), false);
  }
});

test('CLI help shows how to initialize a project with options', () => {
  const help = success(['--help']);
  assert.match(help, /scaffold\.mjs\s+--template/);
  for (const { template } of stacks) assert.ok(help.includes(template));
});

test('skill examples pair the preview with an identical initialization command', () => {
  const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
  const commands = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n');
  const stub = 'node() { printf \'%s\\0\' "$@"; printf \'\\1\'; }\n';
  const output = execFileSync('bash', ['-eu', '-c', stub + commands], { encoding: 'utf8', stdio: 'pipe' });
  const calls = output.split('\x01').filter(Boolean).map((call) => call.split('\0').slice(0, -1));
  const examples = calls.filter((args) => args.includes('--template'));
  assert.ok(examples.length >= 2);
  assert.equal(examples.length % 2, 0);
  for (let i = 0; i < examples.length; i += 2) {
    assert.ok(examples[i][1].startsWith('--'));
    assert.ok(examples[i].includes('--dry-run'));
    assert.deepEqual(examples[i].filter((arg) => arg !== '--dry-run'), examples[i + 1]);
  }
});
